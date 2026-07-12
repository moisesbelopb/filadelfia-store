"use server";

import { type ActionResult, fail, ok } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { NATIVE_ADMIN_EMAIL, getCurrentUser, isAdminUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import {
  createUserSchema,
  deleteUserSchema,
  setActiveSchema,
  setRoleSchema,
} from "@/lib/validators/admin";
import { revalidatePath } from "next/cache";

// Ban "indefinido" no GoTrue (~100 anos). "none" reativa.
const BAN_FOREVER = "876000h";

/** Cria um novo usuário administrador (apenas admin/super_admin). */
export async function createAdminUser(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail("Configure o Supabase para gerenciar usuários.");
  if (!(await isAdminUser())) return fail("Acesso negado.");

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { name, email, password, role } = parsed.data;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return fail("Service role não configurada (SUPABASE_SERVICE_ROLE_KEY).");
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) {
    const msg = /registered|already/i.test(error.message)
      ? "Já existe um usuário com esse e-mail."
      : error.message;
    return fail(msg);
  }
  const uid = data.user?.id;
  if (!uid) return fail("Falha ao criar usuário.");

  // Garante o profile com o papel definido (upsert cobre timing do trigger).
  const { error: pErr } = await admin
    .from("profiles")
    .upsert({ id: uid, full_name: name, role }, { onConflict: "id" });
  if (pErr) return fail(pErr.message);

  const actor = await getCurrentUser();
  await logAudit(actor?.id ?? null, "user.create", "user", uid, { email, role });

  revalidatePath("/admin/usuarios");
  return ok(undefined);
}

/** Altera o papel de um usuário (cliente / admin / super_admin). */
export async function setUserRole(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail("Configure o Supabase.");
  if (!(await isAdminUser())) return fail("Acesso negado.");

  const parsed = setRoleSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");
  const { userId, role } = parsed.data;

  const actor = await getCurrentUser();
  if (actor?.id === userId) {
    return fail("Você não pode alterar o seu próprio papel.");
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return fail("Service role não configurada.");
  }

  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) return fail(error.message);

  await logAudit(actor?.id ?? null, "user.set_role", "user", userId, { role });
  revalidatePath("/admin/usuarios");
  return ok(undefined);
}

/** Desativa (bloqueia login) ou reativa um usuário. Reversível. */
export async function setUserActive(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail("Configure o Supabase.");
  if (!(await isAdminUser())) return fail("Acesso negado.");

  const parsed = setActiveSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");
  const { userId, active } = parsed.data;

  const actor = await getCurrentUser();
  if (actor?.id === userId) return fail("Você não pode desativar a sua própria conta.");

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return fail("Service role não configurada.");
  }

  // O administrador nativo não pode ser desativado.
  const { data: target } = await admin.auth.admin.getUserById(userId);
  const email = target.user?.email ?? "";
  if (email.toLowerCase() === NATIVE_ADMIN_EMAIL) {
    return fail("O administrador nativo não pode ser desativado.");
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : BAN_FOREVER,
  });
  if (error) return fail(error.message);

  await logAudit(
    actor?.id ?? null,
    active ? "user.activate" : "user.deactivate",
    "user",
    userId,
    { email },
  );
  revalidatePath("/admin/usuarios");
  return ok(undefined);
}

/** Exclui um usuário de forma definitiva (bloqueado se tiver pedidos). */
export async function deleteUser(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail("Configure o Supabase.");
  if (!(await isAdminUser())) return fail("Acesso negado.");

  const parsed = deleteUserSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");
  const { userId } = parsed.data;

  const actor = await getCurrentUser();
  if (actor?.id === userId) return fail("Você não pode excluir a sua própria conta.");

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return fail("Service role não configurada.");
  }

  const { data: target } = await admin.auth.admin.getUserById(userId);
  const email = target.user?.email ?? "";
  const name = (target.user?.user_metadata?.full_name as string | undefined) ?? "";
  if (email.toLowerCase() === NATIVE_ADMIN_EMAIL) {
    return fail("O administrador nativo não pode ser excluído.");
  }

  // Pedidos referenciam o usuário (FK RESTRICT) — preserva o histórico.
  const { count } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) > 0) {
    return fail(
      "Este usuário tem pedidos e não pode ser excluído (o histórico é preservado). Desative-o para bloquear o acesso.",
    );
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return fail(
      "Não foi possível excluir. Se o usuário tiver pedidos vinculados, desative-o em vez de excluir.",
    );
  }

  await logAudit(actor?.id ?? null, "user.delete", "user", userId, { email, name });
  revalidatePath("/admin/usuarios");
  return ok(undefined);
}
