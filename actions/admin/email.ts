"use server";

import { type ActionResult, fail, ok } from "@/lib/action-result";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { type CartReminderItem, renderCartReminderEmail } from "@/lib/email/cart-reminder";
import { REASON_EVENTS } from "@/lib/email/defaults";
import { sendEmail } from "@/lib/email/send";
import { type OrderEmailEvent, renderOrderEmail } from "@/lib/email/templates";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { emailEventSchema } from "@/lib/validators/admin";
import type { EmailSettings, OrderWithItems, PixSettings } from "@/types/db";

/** Pedido fictício usado só na prévia — nada é gravado no banco. */
function demoOrder(event: OrderEmailEvent, customerName: string): OrderWithItems {
  const now = new Date().toISOString();
  return {
    id: "00000000-0000-0000-0000-000000000000",
    order_number: 1024,
    user_id: "00000000-0000-0000-0000-000000000000",
    status: "solicitado",
    customer_name: customerName,
    customer_whatsapp: "83999999999",
    address: {
      street: "Rua das Flores",
      number: "100",
      neighborhood: "Centro",
      city: "João Pessoa",
      state: "PB",
      zip: "58000000",
    },
    notes: null,
    payment_method: "pix",
    payment_status: "pendente",
    fulfillment_type: event === "order_ready_pickup" ? "retirada" : "entrega",
    scheduled_date: null,
    scheduled_window: null,
    subtotal: 120,
    delivery_fee: 10,
    total: 130,
    status_reason: REASON_EVENTS.includes(event) ? "Exemplo de motivo informado no painel." : null,
    accepted_at: null,
    delivered_at: null,
    created_at: now,
    updated_at: now,
    order_items: [
      {
        id: "1",
        order_id: "1",
        product_id: null,
        variant_id: null,
        variant_size: "M",
        product_name: "Camiseta Casa de Filadélfia",
        unit_price: 60,
        quantity: 2,
        line_total: 120,
        created_at: now,
      },
    ],
  };
}

/**
 * Envia um e-mail de teste (com pedido fictício) para o e-mail do admin logado.
 * Usa exatamente os textos salvos nas configurações, então serve para conferir
 * o visual e provar que o ZeptoMail está configurado — sem criar pedido real.
 */
export async function sendTestEmail(input: unknown): Promise<ActionResult<string>> {
  if (!isSupabaseConfigured) return fail("Configure o Supabase.");
  if (!(await isAdminUser())) return fail("Acesso negado.");

  const parsed = emailEventSchema.safeParse(input);
  if (!parsed.success) return fail("E-mail inválido.");
  const event = parsed.data;

  const user = await getCurrentUser();
  const to = user?.email;
  if (!to) return fail("Seu usuário não tem e-mail cadastrado.");

  const supabase = await createClient();
  const [{ data: emailSetting }, { data: pixSetting }] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "email").maybeSingle(),
    supabase.from("settings").select("value").eq("key", "pix").maybeSingle(),
  ]);

  const templates = (emailSetting?.value ?? null) as Partial<EmailSettings> | null;
  const customerName = user.user_metadata?.full_name ?? "Maria";

  // Carrinho abandonado não é um pedido: renderiza com itens de exemplo.
  if (event === "cart_abandoned") {
    const demoItems: CartReminderItem[] = [
      { name: "Camiseta Casa de Filadélfia", size: "M", quantity: 1, lineTotal: 60 },
      { name: "Caneca Fé, Esperança e Amor", size: null, quantity: 1, lineTotal: 45 },
    ];
    const { subject, html } = renderCartReminderEmail(
      customerName,
      demoItems,
      105,
      templates?.cart_abandoned,
    );
    const result = await sendEmail({ to, subject: `[TESTE] ${subject}`, html });
    return result.ok ? ok(to) : fail(result.error ?? "Falha no envio do e-mail.");
  }

  const order = demoOrder(event, customerName);
  const { subject, html } = renderOrderEmail(event, order, {
    pix: (pixSetting?.value ?? null) as PixSettings | null,
    templates,
  });

  const result = await sendEmail({ to, subject: `[TESTE] ${subject}`, html });
  return result.ok ? ok(to) : fail(result.error ?? "Falha no envio do e-mail.");
}
