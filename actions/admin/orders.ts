"use server";

import { type ActionResult, fail, ok } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { type OrderEmailEvent, emailEventForStatus } from "@/lib/email/defaults";
import { isSupabaseConfigured } from "@/lib/env";
import { dispatchOrderEmail } from "@/lib/notifications/order-email";
import { REASON_REQUIRED, canTransition } from "@/lib/orders/fsm";
import { statusWhatsappMessage, whatsappLink } from "@/lib/orders/template";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { orderStatusSchema } from "@/lib/validators/admin";
import type { EmailSettings, FulfillmentType, OrderStatus } from "@/types/db";
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
    .select("status, fulfillment_type")
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
  // Cada status do fluxo tem seu e-mail; `saiu_entrega` avisa "pronto para
  // retirada" ou "saiu para entrega" conforme o modo de recebimento.
  const event = emailEventForStatus(to, current.fulfillment_type as FulfillmentType);
  if (event) {
    try {
      await dispatchOrderEmail(orderId, event);
    } catch {
      // best-effort
    }
  }

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${orderId}`);
  return ok(undefined);
}

/**
 * Prepara o aviso de status pelo WhatsApp: monta o link wa.me com a mensagem do
 * status ATUAL do pedido e registra em notification_logs (channel='whatsapp'),
 * para aparecer em "Avisos enviados ao cliente". O envio em si é manual — o
 * admin confere e envia no WhatsApp que abrimos. Derivar o evento do status
 * salvo (não confiar no cliente) mantém a mensagem sempre coerente com o pedido.
 */
export async function notifyStatusWhatsapp(
  orderId: string,
): Promise<ActionResult<{ waUrl: string }>> {
  if (!isSupabaseConfigured) return fail("Configure o Supabase.");
  if (!(await isAdminUser())) return fail("Acesso negado.");

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_whatsapp, status, fulfillment_type, status_reason",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return fail("Pedido não encontrado.");
  if (!order.customer_whatsapp?.trim()) return fail("Este pedido não tem WhatsApp cadastrado.");

  // 'solicitado' não tem transição de e-mail, mas o aviso equivalente é "pedido recebido".
  const event: OrderEmailEvent | null =
    order.status === "solicitado"
      ? "order_placed"
      : emailEventForStatus(order.status as OrderStatus, order.fulfillment_type as FulfillmentType);
  if (!event) return fail("Este status não tem aviso para o cliente.");

  const { data: emailSetting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "email")
    .maybeSingle();

  const message = statusWhatsappMessage(
    order,
    event,
    (emailSetting?.value ?? null) as Partial<EmailSettings> | null,
  );
  const waUrl = whatsappLink(order.customer_whatsapp, message);

  // Registra o aviso (RLS só libera INSERT via service role).
  const user = await getCurrentUser();
  try {
    const service = createServiceClient();
    await service.from("notification_logs").insert({
      order_id: order.id,
      channel: "whatsapp",
      template_key: event,
      phone: order.customer_whatsapp,
      status: "enviado",
    });
  } catch {
    // Não impede o envio: se o registro falhar, o link ainda abre.
  }
  await logAudit(user?.id ?? null, "order.notify_whatsapp", "order", order.id, { event });

  revalidatePath(`/admin/pedidos/${orderId}`);
  return ok({ waUrl });
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
