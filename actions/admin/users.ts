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
