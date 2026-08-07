"use server";

import { type ActionResult, fail, ok } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/utils";
import { orderPaymentSchema, orderRefundSchema } from "@/lib/validators/admin";
import { revalidatePath } from "next/cache";

/** Soma líquida recebida: pagamentos menos estornos. */
function netPaid(pays: { amount: number; kind?: string | null }[] | null): number {
  return (pays ?? []).reduce(
    (s, p) => s + (p.kind === "estorno" ? -Number(p.amount) : Number(p.amount)),
    0,
  );
}

async function guard(): Promise<{ ok: false; error: string } | null> {
  if (!isSupabaseConfigured) return fail("Configure o Supabase.");
  if (!(await isAdminUser())) return fail("Acesso negado.");
  return null;
}

/** Recalcula payment_status do pedido: 'pago' se a soma dos pagamentos cobre o total. */
async function recomputeStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
): Promise<void> {
  const [{ data: order }, { data: pays }] = await Promise.all([
    supabase.from("orders").select("total").eq("id", orderId).maybeSingle(),
    supabase.from("order_payments").select("amount, kind").eq("order_id", orderId),
  ]);
  if (!order) return;
  const paid = netPaid(pays as { amount: number; kind: string }[] | null);
  const status = paid >= Number((order as { total: number }).total) ? "pago" : "pendente";
  await supabase.from("orders").update({ payment_status: status }).eq("id", orderId);
}

/** Registra um pagamento (parcial ou total) no pedido. */
export async function addOrderPayment(input: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  const parsed = orderPaymentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { orderId, amount, method, cardInstallments } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("order_payments").insert({
    order_id: orderId,
    amount,
    method,
    kind: "pagamento",
    card_installments: method === "cartao" ? (cardInstallments ?? null) : null,
  });
  if (error) return fail(error.message);

  await recomputeStatus(supabase, orderId);
  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, "order.payment.add", "order", orderId, { amount, method });
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
  return ok(undefined);
}

/**
 * Registra um ESTORNO (parcial ou total) no pedido: entra como lançamento que
 * subtrai do recebido (pedido e dashboard). Não deixa estornar mais do que o
 * recebido atual. Um estorno que zera o recebido volta o pedido a "pendente".
 */
export async function addOrderRefund(input: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  const parsed = orderRefundSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { orderId, amount, method, note } = parsed.data;

  const supabase = await createClient();
  const { data: pays } = await supabase
    .from("order_payments")
    .select("amount, kind")
    .eq("order_id", orderId);
  const recebido = netPaid(pays as { amount: number; kind: string }[] | null);
  if (recebido <= 0) return fail("Não há valor recebido para estornar neste pedido.");
  if (amount > recebido + 0.001) {
    return fail(
      `O estorno (${formatBRL(amount)}) não pode ser maior que o recebido (${formatBRL(recebido)}).`,
    );
  }

  const { error } = await supabase.from("order_payments").insert({
    order_id: orderId,
    amount,
    method,
    kind: "estorno",
    note: note?.trim() || null,
  });
  if (error) return fail(error.message);

  await recomputeStatus(supabase, orderId);
  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, "order.payment.refund", "order", orderId, {
    amount,
    method,
    note: note?.trim() || null,
  });
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
  return ok(undefined);
}

/** Remove um pagamento do pedido. */
export async function deleteOrderPayment(
  paymentId: string,
  orderId: string,
): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;

  const supabase = await createClient();
  const { error } = await supabase.from("order_payments").delete().eq("id", paymentId);
  if (error) return fail(error.message);

  await recomputeStatus(supabase, orderId);
  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, "order.payment.remove", "order", orderId);
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
  return ok(undefined);
}
