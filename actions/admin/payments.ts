"use server";

import { type ActionResult, fail, ok } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { orderPaymentSchema } from "@/lib/validators/admin";
import { revalidatePath } from "next/cache";

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
    supabase.from("order_payments").select("amount").eq("order_id", orderId),
  ]);
  if (!order) return;
  const paid = ((pays as { amount: number }[] | null) ?? []).reduce(
    (s, p) => s + Number(p.amount),
    0,
  );
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
