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
import type { UserRole } from "@/types/db";
import { revalidatePath } from "next/cache";

// Ban "indefinido" no GoTrue (~100 anos). "none" reativa.
const BAN_FOREVER = "876000h";

/** Resultado do "Novo administrador": criou do zero ou promoveu conta existente. */
export type CreateUserResult = { promoted: boolean; name: string };

/**
 * Localiza um usuário do Auth pelo e-mail (case-insensitive). O Auth não expõe
 * "buscar por e-mail", então varremos a lista (loja pequena; perPage alto).
 */
async function findUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<{ id: string; email: string } | null> {
  const target = email.toLowerCase();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = (data?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === target);
  return found ? { id: found.id, email: found.email ?? email } : null;
}

/**
 * Cria um novo administrador — ou, se o e-mail já pertencer a alguém (ex.: um
 * cliente da loja), PROMOVE essa conta ao papel escolhido mantendo a senha
 * atual da pessoa. O campo de senha é ignorado ao promover. Apenas admin.
 */
export async function createAdminUser(input: unknown): Promise<ActionResult<CreateUserResult>> {
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

  const actor = await getCurrentUser();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  // E-mail já existe: promove a conta atual em vez de recusar.
  if (error && /registered|already/i.test(error.message)) {
    return promoteExistingUser(admin, email, role, actor?.id ?? null);
  }
  if (error) return fail(error.message);

  const uid = data.user?.id;
  if (!uid) return fail("Falha ao criar usuário.");

  // Garante o profile com o papel definido (upsert cobre timing do trigger).
  const { error: pErr } = await admin
    .from("profiles")
    .upsert({ id: uid, full_name: name, role }, { onConflict: "id" });
  if (pErr) return fail(pErr.message);

  await logAudit(actor?.id ?? null, "user.create", "user", uid, { email, role });

  revalidatePath("/admin/usuarios");
  return ok({ promoted: false, name });
}

/** Promove um usuário já existente (normalmente cliente) ao papel de admin. */
async function promoteExistingUser(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  role: "admin" | "super_admin",
  actorId: string | null,
): Promise<ActionResult<CreateUserResult>> {
  const existing = await findUserByEmail(admin, email);
  if (!existing) {
    return fail("Já existe um usuário com esse e-mail, mas não foi possível localizá-lo.");
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role, full_name")
    .eq("id", existing.id)
    .maybeSingle();
  const currentRole = (profile?.role as UserRole | undefined) ?? "cliente";

  if (currentRole === "admin" || currentRole === "super_admin") {
    return fail("Esse e-mail já é um administrador do painel.");
  }

  // Mantém o nome que a pessoa já tem; só define papel de administrador.
  const { error } = await admin.from("profiles").update({ role }).eq("id", existing.id);
  if (error) return fail("Não foi possível promover este usuário.");

  const name = (profile?.full_name as string | undefined)?.trim() || existing.email;
  await logAudit(actorId, "user.promote", "user", existing.id, {
    email: existing.email,
    from: currentRole,
    to: role,
  });

  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/clientes");
  return ok({ promoted: true, name });
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

  await logAudit(actor?.id ?? null, active ? "user.activate" : "user.deactivate", "user", userId, {
    email,
  });
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

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = (profile?.role as string | undefined) ?? "cliente";

  // Pedidos: FK RESTRICT no profile, então precisam sair antes. Apagar o pedido
  // remove itens/histórico em cascata (movimentos e notificações ficam com o
  // vínculo nulo). A confirmação na tela avisa que o histórico vai junto.
  const { data: orders } = await admin
    .from("orders")
    .select("id, status, order_items(variant_id, quantity)")
    .eq("user_id", userId);

  // Pedidos ATIVOS ainda seguram estoque reservado (a baixa acontece na criação
  // e só volta em cancelado/recusado). Devolvemos antes de apagar, senão o
  // estoque some junto com o pedido.
  const RESERVED_STATUSES = ["solicitado", "aceito", "em_separacao", "saiu_entrega"];
  const restock = new Map<string, number>();
  for (const o of (orders ?? []) as {
    id: string;
    status: string;
    order_items: { variant_id: string | null; quantity: number }[] | null;
  }[]) {
    if (!RESERVED_STATUSES.includes(o.status)) continue;
    for (const item of o.order_items ?? []) {
      if (!item.variant_id) continue;
      restock.set(item.variant_id, (restock.get(item.variant_id) ?? 0) + item.quantity);
    }
  }
  for (const [variantId, qty] of restock) {
    const { data: v } = await admin
      .from("product_variants")
      .select("stock")
      .eq("id", variantId)
      .maybeSingle();
    if (v) {
      // O trigger sync_product_stock recalcula products.stock a partir daqui.
      await admin
        .from("product_variants")
        .update({ stock: Number(v.stock) + qty })
        .eq("id", variantId);
    }
  }

  const ordersDeleted = orders?.length ?? 0;
  if (ordersDeleted > 0) {
    const { error: oErr } = await admin.from("orders").delete().eq("user_id", userId);
    if (oErr) return fail("Não foi possível excluir o histórico de pedidos.");
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return fail("Não foi possível concluir a exclusão.");

  await logAudit(actor?.id ?? null, "user.delete", "user", userId, {
    email,
    name,
    role,
    ordersDeleted,
  });
  revalidatePath("/admin/usuarios");
  return ok(undefined);
}
