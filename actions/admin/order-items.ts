"use server";

import { type ActionResult, fail, ok } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { itemChangeSchema, itemDeleteSchema, itemPendingSchema } from "@/lib/validators/admin";
import { revalidatePath } from "next/cache";

/** Mensagem amigável para o erro que o banco devolve ao editar itens. */
function friendlyItemError(msg: string): string {
  if (msg.includes("Estoque insuficiente")) return msg; // já vem em PT, com item e tamanho
  if (msg.includes("ao menos um item")) return msg;
  if (msg.includes("Quantidade inválida")) return "Quantidade inválida (1 a 99).";
  if (msg.includes("Acesso negado")) return "Acesso negado.";
  if (msg.includes("não encontrado")) return "Item não encontrado.";
  return "Não foi possível alterar o item. Tente novamente.";
}

/** Revalida o pedido (admin + cliente) e o dashboard após editar itens. */
function revalidateOrder(orderId: string): void {
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
}

/**
 * Marca (ou limpa) a pendência de um item do pedido — ex.: item em falta,
 * cliente aguardando reposição. Texto vazio remove a pendência. A observação
 * fica visível ao cliente e ao admin no detalhe do pedido.
 */
export async function setItemPending(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail("Configure o Supabase.");
  if (!(await isAdminUser())) return fail("Acesso negado.");

  const parsed = itemPendingSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");
  const { itemId, note } = parsed.data;

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("order_items")
    .select("id, order_id, product_name")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return fail("Item não encontrado.");

  const clean = note.trim();
  const { error } = await supabase
    .from("order_items")
    .update({ pending_note: clean || null })
    .eq("id", itemId);
  if (error) return fail(error.message);

  const orderId = item.order_id as string;
  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, "order.item_pending", "order", orderId, {
    product: item.product_name,
    note: clean || null,
  });
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath(`/pedidos/${orderId}`);
  return ok(undefined);
}

/**
 * Exclui um item do pedido (via RPC): devolve o estoque quando o pedido está
 * reservado, recalcula o total e o status de pagamento (reflete no dashboard).
 */
export async function deleteOrderItem(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail("Configure o Supabase.");
  if (!(await isAdminUser())) return fail("Acesso negado.");
  const parsed = itemDeleteSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");
  const { itemId } = parsed.data;

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("order_items")
    .select("order_id, product_name")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return fail("Item não encontrado.");

  const { error } = await supabase.rpc("admin_delete_order_item", { p_item: itemId });
  if (error) return fail(friendlyItemError(error.message));

  const orderId = item.order_id as string;
  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, "order.item_delete", "order", orderId, {
    product: item.product_name,
  });
  revalidateOrder(orderId);
  return ok(undefined);
}

/**
 * Altera um item (via RPC): quantidade e/ou variante (tamanho ou produto).
 * Ajusta o estoque (devolve o antigo, reserva o novo — falha se faltar),
 * recalcula o total e o status de pagamento (reflete no dashboard).
 */
export async function changeOrderItem(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail("Configure o Supabase.");
  if (!(await isAdminUser())) return fail("Acesso negado.");
  const parsed = itemChangeSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");
  const { itemId, variantId, quantity } = parsed.data;

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("order_items")
    .select("order_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return fail("Item não encontrado.");

  const { error } = await supabase.rpc("admin_change_order_item", {
    p_item: itemId,
    p_variant: variantId,
    p_qty: quantity,
  });
  if (error) return fail(friendlyItemError(error.message));

  const orderId = item.order_id as string;
  const { data: updated } = await supabase
    .from("order_items")
    .select("product_name, variant_size, quantity")
    .eq("id", itemId)
    .maybeSingle();
  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, "order.item_change", "order", orderId, {
    product: updated?.product_name ?? null,
    size: updated?.variant_size ?? null,
    quantity: updated?.quantity ?? quantity,
  });
  revalidateOrder(orderId);
  return ok(undefined);
}
