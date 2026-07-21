import { DEFAULT_EMAILS, type OrderEmailEvent, REASON_EVENTS } from "@/lib/email/defaults";
import { formatScheduled } from "@/lib/orders/delivery";
import { formatBRL, normalizePhone } from "@/lib/utils";
import type { EmailSettings, OrderWithItems, PixSettings } from "@/types/db";

/**
 * Mensagem padrão do Pix. Pré-preenche o campo da Comunicação e também serve
 * de fallback quando nenhum template foi salvo. Editável no painel.
 */
export const DEFAULT_PIX_MESSAGE = `Olá {{cliente}}! 🙏

Seu pedido {{pedido}} foi aceito! Para concluir, é só fazer um Pix de {{valor}}:

🔑 Chave Pix: {{chave_pix}}
👤 Recebedor: {{recebedor}}

Itens do pedido:
{{itens}}

📎 Depois de pagar, envie o comprovante aqui mesmo nesta conversa para confirmarmos.

Assim que o pagamento for confirmado, seu pedido segue para separação e entrega. Qualquer dúvida, é só responder por aqui. Deus abençoe! ✨`;

/**
 * Config Pix padrão da loja — usada quando o admin ainda não preencheu as
 * configurações. A chave e o WhatsApp são dados públicos de pagamento; o admin
 * pode sobrescrevê-los em Comunicação → Pix.
 */
export const STORE_PIX_DEFAULTS: PixSettings = {
  chave: "pixdaconquista@gmail.com",
  recebedor: "Casa de Filadélfia",
  banco: "",
  whatsapp_loja: "(83) 2178-8064",
};

/** Mescla a config salva com os padrões (campo vazio cai no padrão). */
export function resolveStorePix(pix: PixSettings | null): PixSettings {
  return {
    chave: pix?.chave?.trim() || STORE_PIX_DEFAULTS.chave,
    recebedor: pix?.recebedor?.trim() || STORE_PIX_DEFAULTS.recebedor,
    banco: pix?.banco?.trim() || STORE_PIX_DEFAULTS.banco,
    whatsapp_loja: pix?.whatsapp_loja?.trim() || STORE_PIX_DEFAULTS.whatsapp_loja,
    observacao: pix?.observacao,
  };
}

/**
 * Mensagem que o CLIENTE envia à loja junto com o comprovante do Pix. Abre no
 * WhatsApp da loja já preenchida (fluxo: paga primeiro; a equipe confere o
 * comprovante e só então aceita o pedido). Puxa nº do pedido, cliente, itens,
 * total e entrega/retirada.
 */
export function pixComprovanteMessage(order: OrderWithItems): string {
  const itens = order.order_items
    .map(
      (i) =>
        `• ${i.quantity}x ${i.product_name}${i.variant_size ? ` — Tam. ${i.variant_size}` : ""}`,
    )
    .join("\n");
  const quando = order.scheduled_date
    ? `: ${formatScheduled(order.scheduled_date, order.scheduled_window)}`
    : "";
  const entrega =
    order.fulfillment_type === "retirada"
      ? `⛪ Retirada na igreja${quando}`
      : `🛵 Entrega${quando}`;

  return [
    "Olá, Casa de Filadélfia! 🙏",
    "",
    "Acabei de finalizar meu pedido pelo site e paguei via Pix.",
    "Vou enviar o comprovante a seguir. 📎",
    "",
    `🧾 Pedido: #${order.order_number}`,
    `👤 Cliente: ${order.customer_name}`,
    "🛍️ Itens:",
    itens,
    `💰 Total: ${formatBRL(order.total)}`,
    entrega,
    "",
    "Estou ciente de que o pedido só será confirmado após a conferência do comprovante do Pix. Obrigado! ✨",
  ].join("\n");
}

/** Substitui {{variaveis}} pelo valor correspondente. */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => vars[key] ?? "");
}

/** Variáveis disponíveis para a mensagem Pix. */
export function pixVars(order: OrderWithItems, pix: PixSettings): Record<string, string> {
  const itens = order.order_items.map((i) => `- ${i.quantity}x ${i.product_name}`).join("\n");
  return {
    cliente: order.customer_name,
    pedido: String(order.order_number),
    valor: formatBRL(order.total),
    chave_pix: pix.chave,
    recebedor: pix.recebedor,
    itens,
  };
}

/** Mensagem do pedido pronta para enviar (template salvo ou o padrão). */
export function pixMessage(
  order: OrderWithItems,
  pix: PixSettings | null,
  templateBody?: string | null,
): string {
  const body = templateBody?.trim() ? templateBody : DEFAULT_PIX_MESSAGE;
  return renderTemplate(body, pixVars(order, pix ?? { chave: "", recebedor: "" }));
}

/**
 * Mensagem de WhatsApp que avisa o cliente sobre o NOVO status do pedido.
 * Reaproveita o texto do e-mail daquele evento (o admin pode ter personalizado
 * em Comunicação; senão usa o padrão), então os dois canais falam igual.
 */
export function statusWhatsappMessage(
  order: { customer_name: string; order_number: number; status_reason?: string | null },
  event: OrderEmailEvent,
  emailTemplates?: Partial<EmailSettings> | null,
): string {
  const t = { ...DEFAULT_EMAILS[event], ...(emailTemplates?.[event] ?? {}) };
  const vars = {
    cliente: order.customer_name,
    pedido: String(order.order_number),
    motivo: order.status_reason?.trim() ?? "",
  };
  const linhas = [
    `Olá ${order.customer_name}! Aqui é da Casa de Filadélfia 🙏`,
    "",
    renderTemplate(t.intro, vars),
  ];
  // Recusa/cancelamento: o motivo informado no painel entra na mensagem.
  if (REASON_EVENTS.includes(event) && vars.motivo) {
    linhas.push("", `Motivo: ${vars.motivo}`);
  }
  linhas.push("", `📦 Pedido #${order.order_number}`);
  return linhas.join("\n");
}

/** Monta o link wa.me (click-to-chat) com o texto já preenchido. */
export function whatsappLink(phone: string, text?: string): string {
  const number = normalizePhone(phone);
  return text
    ? `https://wa.me/${number}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${number}`;
}
