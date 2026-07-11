import "server-only";

import { type ActionResult, fail, ok } from "@/lib/action-result";
import { type OrderEmailEvent, renderOrderEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/zeptomail";
import { isZeptomailConfigured } from "@/lib/env";
import { createAdminClient, createServiceClient } from "@/lib/supabase/server";
import type { EmailSettings, OrderWithItems, PixSettings } from "@/types/db";

/**
 * Envia o e-mail transacional do pedido (recebido/confirmado/entregue) pelo
 * ZeptoMail e registra em notification_logs (channel='email').
 * O e-mail do cliente vem do Auth — o checkout não coleta e-mail, mas todo
 * cliente se cadastra com e-mail (ou Google). Usa clients server-only.
 */
export async function dispatchOrderEmail(
  orderId: string,
  event: OrderEmailEvent,
): Promise<ActionResult> {
  if (!isZeptomailConfigured) return fail("ZeptoMail não configurado.");

  let service: ReturnType<typeof createServiceClient>;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    service = createServiceClient();
    admin = createAdminClient();
  } catch {
    return fail("Serviço de e-mail indisponível.");
  }

  const { data: orderData } = await service
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .maybeSingle();
  if (!orderData) return fail("Pedido não encontrado.");
  const order = orderData as OrderWithItems;

  // E-mail do destinatário: buscado no Auth pelo user_id do pedido.
  const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(order.user_id);
  const email = userRes?.user?.email ?? null;
  if (userErr || !email) return fail("Cliente sem e-mail cadastrado.");

  // Textos dos e-mails configurados no admin (fallback nos padrões).
  const { data: emailSetting } = await service
    .from("settings")
    .select("value")
    .eq("key", "email")
    .maybeSingle();
  const templates = (emailSetting?.value ?? null) as Partial<EmailSettings> | null;

  // Pedido Pix confirmado: leva a chave Pix + link do WhatsApp da loja no e-mail.
  let pix: PixSettings | null = null;
  if (event === "order_accepted" && order.payment_method === "pix") {
    const { data: setting } = await service
      .from("settings")
      .select("value")
      .eq("key", "pix")
      .maybeSingle();
    pix = (setting?.value ?? null) as PixSettings | null;
  }

  const { subject, html } = renderOrderEmail(event, order, { pix, templates });
  const result = await sendEmail({ to: email, toName: order.customer_name, subject, html });

  await service.from("notification_logs").insert({
    order_id: order.id,
    channel: "email",
    template_key: event,
    phone: null,
    status: result.ok ? "enviado" : "erro",
    request: result.request ?? null,
    response: (result.data as Record<string, unknown> | null) ?? null,
    error: result.error ?? null,
  });

  return result.ok ? ok(undefined) : fail(result.error ?? "Falha no envio do e-mail.");
}
