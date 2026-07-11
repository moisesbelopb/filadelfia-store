"use server";

import { type ActionResult, fail, ok } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { dispatchOrderEmail } from "@/lib/notifications/order-email";
import { REASON_REQUIRED, canTransition } from "@/lib/orders/fsm";
import { createClient } from "@/lib/supabase/server";
import { orderStatusSchema } from "@/lib/validators/admin";
import type { OrderStatus } from "@/types/db";
import { revalidatePath } from "next/cache";

export async function changeOrderStatus(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail("Configure o Supabase.");
  if (!(await isAdminUser())) return fail("Acesso negado.");

  const parsed = orderStatusSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");
  const { orderId, to, reason } = parsed.data;

  if (REASON_REQUIRED.includes(to) && !reason?.trim()) {
    return fail("Informe o motivo.");
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();
  if (!current) return fail("Pedido não encontrado.");

  if (!canTransition(current.status as OrderStatus, to)) {
    return fail(`Transição não permitida (${current.status} → ${to}).`);
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: to, status_reason: reason ?? null })
    .eq("id", orderId);
  if (error) return fail(error.message);

  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, `order.${to}`, "order", orderId, { reason });

  // E-mail transacional ao cliente (best-effort — não bloqueia a transição).
  if (to === "aceito" || to === "entregue") {
    try {
      await dispatchOrderEmail(orderId, to === "aceito" ? "order_accepted" : "order_delivered");
    } catch {
      // best-effort
    }
  }

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${orderId}`);
  return ok(undefined);
}

export async function markOrderPaid(orderId: string): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail("Configure o Supabase.");
  if (!(await isAdminUser())) return fail("Acesso negado.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ payment_status: "pago" })
    .eq("id", orderId);
  if (error) return fail(error.message);

  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, "order.paid", "order", orderId);

  revalidatePath(`/admin/pedidos/${orderId}`);
  return ok(undefined);
}
