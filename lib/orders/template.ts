import { formatBRL, normalizePhone } from "@/lib/utils";
import type { OrderWithItems, PixSettings } from "@/types/db";

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

/** Monta o link wa.me (click-to-chat) com o texto já preenchido. */
export function whatsappLink(phone: string, text?: string): string {
  const number = normalizePhone(phone);
  return text
    ? `https://wa.me/${number}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${number}`;
}
