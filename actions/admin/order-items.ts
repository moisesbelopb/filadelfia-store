"use server";

import { type ActionResult, fail, ok } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { itemPendingSchema } from "@/lib/validators/admin";
import { revalidatePath } from "next/cache";

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
