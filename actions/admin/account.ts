"use server";

import { type ActionResult, fail, ok } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, isOwner } from "@/lib/auth";
import { SUPABASE_ANON_KEY_SAFE, SUPABASE_URL_SAFE, isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { changeEmailSchema, changePasswordSchema } from "@/lib/validators/admin";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

/**
 * Confirma a senha atual do próprio usuário sem mexer na sessão dele.
 * Usa um client descartável (sem persistir sessão nem renovar token), então
 * o cookie do usuário logado não é rotacionado. É a etapa de reautenticação
 * que protege contra troca de credenciais por uma sessão sequestrada.
 */
async function passwordIsValid(email: string, password: string): Promise<boolean> {
  const throwaway = createSupabaseClient(SUPABASE_URL_SAFE, SUPABASE_ANON_KEY_SAFE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await throwaway.auth.signInWithPassword({ email, password });
  // Revoga o refresh token recém-criado para não deixar sessão pendurada.
  if (!error) await throwaway.auth.signOut();
  return !error;
}

/** Troca a senha do dono do sistema (exige a senha atual). Só o dono. */
export async function changeMyPassword(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail("Configure o Supabase.");
  if (!(await isOwner())) return fail("Acesso negado.");

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { currentPassword, newPassword } = parsed.data;

  const user = await getCurrentUser();
  if (!user?.email) return fail("Sessão inválida. Entre novamente.");

  if (!(await passwordIsValid(user.email, currentPassword))) {
    return fail("A senha atual está incorreta.");
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return fail("Service role não configurada (SUPABASE_SERVICE_ROLE_KEY).");
  }

  const { error } = await admin.auth.admin.updateUserById(user.id, { password: newPassword });
  if (error) return fail("Não foi possível alterar a senha. Tente novamente.");

  await logAudit(user.id, "account.password_change", "user", user.id);
  return ok(undefined);
}

/** Troca o e-mail do dono do sistema (exige a senha atual). Só o dono. */
export async function changeMyEmail(input: unknown): Promise<ActionResult<string>> {
  if (!isSupabaseConfigured) return fail("Configure o Supabase.");
  if (!(await isOwner())) return fail("Acesso negado.");

  const parsed = changeEmailSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { currentPassword, newEmail } = parsed.data;

  const user = await getCurrentUser();
  if (!user?.email) return fail("Sessão inválida. Entre novamente.");

  if (newEmail === user.email.toLowerCase()) {
    return fail("O novo e-mail é igual ao atual.");
  }

  if (!(await passwordIsValid(user.email, currentPassword))) {
    return fail("A senha atual está incorreta.");
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return fail("Service role não configurada (SUPABASE_SERVICE_ROLE_KEY).");
  }

  // Grava a flag de dono junto com o novo e-mail: o status de dono passa a ser
  // reconhecido pela flag (não mais pelo e-mail), então o dono continua dono
  // mesmo com o e-mail diferente do NATIVE_ADMIN_EMAIL do ambiente.
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    email: newEmail,
    email_confirm: true,
    app_metadata: { ...(user.app_metadata ?? {}), is_owner: true },
  });
  if (error) {
    const dup = /registered|already|exist|unique/i.test(error.message);
    return fail(
      dup ? "Já existe uma conta com esse e-mail." : "Não foi possível alterar o e-mail.",
    );
  }

  await logAudit(user.id, "account.email_change", "user", user.id, {
    from: user.email,
    to: newEmail,
  });
  revalidatePath("/admin/conta");
  return ok(newEmail);
}
