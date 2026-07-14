import { DEFAULT_EMAILS, type OrderEmailEvent, REASON_EVENTS } from "@/lib/email/defaults";
import { SITE_URL } from "@/lib/env";
import { formatScheduled } from "@/lib/orders/delivery";
import { PAYMENT_LABEL } from "@/lib/orders/fsm";
import { renderTemplate, whatsappLink } from "@/lib/orders/template";
import { formatBRL } from "@/lib/utils";
import type { Address, EmailSettings, OrderWithItems, PixSettings } from "@/types/db";

export type { OrderEmailEvent };

const BRAND = "Casa de Filadélfia";

/** Cor de destaque por evento (não é editável no admin). */
const ACCENT: Record<OrderEmailEvent, string> = {
  order_placed: "#141414",
  order_accepted: "#141414",
  order_separated: "#141414",
  order_ready_pickup: "#141414",
  order_shipped: "#141414",
  order_delivered: "#1a7f4b",
  order_rejected: "#8f3a2f",
  order_canceled: "#8f3a2f",
};

/** Escapa texto vindo do usuário/admin antes de interpolar no HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatAddress(a: Address): string {
  const rua = [a.street, a.number].filter(Boolean).join(", ");
  const line1 = a.complement ? `${rua} — ${a.complement}` : rua;
  const line2 = [a.neighborhood, [a.city, a.state].filter(Boolean).join("/")]
    .filter(Boolean)
    .join(" · ");
  const line3 = a.zip ? `CEP ${a.zip}` : "";
  return [line1, line2, line3].filter(Boolean).map(esc).join("<br>");
}

/** Bloco de recebimento: modo + agendamento + endereço (ou retirada). */
function formatFulfillment(order: OrderWithItems): string {
  const when = order.scheduled_date
    ? esc(formatScheduled(order.scheduled_date, order.scheduled_window))
    : "";
  if (order.fulfillment_type === "retirada") {
    return ["Retirada na igreja", when].filter(Boolean).join("<br>");
  }
  const addr = order.address ? formatAddress(order.address) : "";
  return [when, addr].filter(Boolean).join("<br>") || "—";
}

/**
 * Bloco de pagamento Pix + botão "Enviar comprovante pelo WhatsApp".
 * Só aparece no e-mail de confirmação (order_accepted) de pedidos Pix com
 * a chave configurada. O botão de WhatsApp exige o número da loja definido
 * nas configurações (pix.whatsapp_loja); sem ele, mostra só a instrução.
 */
function renderPixBlock(order: OrderWithItems, pix: PixSettings): string {
  const waMessage = `Olá! Segue o comprovante do pedido #${order.order_number}.`;
  const waHref = pix.whatsapp_loja ? whatsappLink(pix.whatsapp_loja, waMessage) : null;
  const waButton = waHref
    ? `<a href="${waHref}" style="display:inline-block;margin:16px 0 0;background:#1a7f4b;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.06em;padding:13px 24px;border-radius:10px;">
            Enviar comprovante pelo WhatsApp
          </a>`
    : "";

  return `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="background:#faf7f0;border:1px solid #e6ddcb;border-radius:12px;padding:22px 24px;">
              <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#8a8577;margin-bottom:12px;">
                Pague com Pix · ${formatBRL(order.total)}
              </div>
              <div style="font-size:12px;color:#6b6b6b;margin-bottom:6px;">Chave Pix</div>
              <div style="font-size:16px;font-weight:700;color:#141414;word-break:break-all;background:#ffffff;border:1px solid #eee9df;border-radius:8px;padding:12px 14px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;">
                ${esc(pix.chave)}
              </div>
              <p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#3f3d38;">
                Recebedor: <strong>${esc(pix.recebedor)}</strong>
              </p>
              <p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:#6b6b6b;">
                Depois de pagar, envie o comprovante pelo WhatsApp da loja para confirmarmos o pagamento.
              </p>
              ${waButton}
            </td></tr>
          </table>`;
}

/** Motivo informado pelo admin ao recusar/cancelar o pedido. */
function renderReasonBlock(reason: string): string {
  return `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="background:#fbf1ef;border:1px solid #eccfc9;border-radius:12px;padding:18px 22px;">
              <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#8f3a2f;margin-bottom:8px;">
                Motivo
              </div>
              <div style="font-size:14px;line-height:1.6;color:#3f3d38;">${esc(reason)}</div>
            </td></tr>
          </table>`;
}

/**
 * Monta o assunto + HTML do e-mail transacional do pedido.
 * Os textos (assunto/título/mensagem) vêm das configurações do admin
 * (opts.templates) com fallback nos padrões; suportam {{cliente}}, {{pedido}}
 * e, na recusa/cancelamento, {{motivo}}.
 */
export function renderOrderEmail(
  event: OrderEmailEvent,
  order: OrderWithItems,
  opts: { pix?: PixSettings | null; templates?: Partial<EmailSettings> | null } = {},
): { subject: string; html: string } {
  const reason = order.status_reason?.trim() ?? "";
  const vars = {
    cliente: order.customer_name,
    pedido: String(order.order_number),
    motivo: reason,
  };
  const t = { ...DEFAULT_EMAILS[event], ...(opts.templates?.[event] ?? {}) };
  const subject = renderTemplate(t.subject, vars);
  const heading = renderTemplate(t.heading, vars);
  const intro = renderTemplate(t.intro, vars);
  const accent = ACCENT[event];

  const showPix =
    event === "order_accepted" && order.payment_method === "pix" && Boolean(opts.pix?.chave);
  const pixBlock = showPix ? renderPixBlock(order, opts.pix as PixSettings) : "";
  const reasonBlock = REASON_EVENTS.includes(event) && reason ? renderReasonBlock(reason) : "";

  // Botão do e-mail: leva ao login já apontando para a área do cliente — o
  // pedido só é visível autenticado, então mandar direto para /pedidos/:id
  // esbarraria no login mesmo assim.
  const accountUrl = `${SITE_URL}/login?redirect=%2Fconta`;
  // Imagem precisa de URL absoluta e pública (e-mail não enxerga assets locais).
  const logoUrl = `${SITE_URL}/logo.png`;
  const frete = Number(order.delivery_fee) > 0 ? formatBRL(order.delivery_fee) : "Grátis";
  const pagamento = PAYMENT_LABEL[order.payment_method] ?? order.payment_method;

  const rows = order.order_items
    .map(
      (i) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #eee9df;font-size:14px;color:#141414;">
            ${esc(i.product_name)}<span style="color:#8a8577;">&nbsp;×&nbsp;${i.quantity}</span>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #eee9df;font-size:14px;color:#141414;text-align:right;white-space:nowrap;">
            ${formatBRL(i.line_total)}
          </td>
        </tr>`,
    )
    .join("");

  const totalRow = (label: string, value: string, strong = false) => `
    <tr>
      <td style="padding:4px 0;font-size:${strong ? "16px" : "14px"};color:${strong ? "#141414" : "#6b6b6b"};${strong ? "font-weight:700;" : ""}">${label}</td>
      <td style="padding:4px 0;font-size:${strong ? "16px" : "14px"};color:#141414;text-align:right;white-space:nowrap;${strong ? "font-weight:700;" : ""}">${value}</td>
    </tr>`;

  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f2ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(intro)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ec;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <tr><td style="background:${accent};border-radius:14px 14px 0 0;height:6px;line-height:6px;font-size:0;">&nbsp;</td></tr>

        <tr><td align="center" style="background:#ffffff;padding:28px 32px 4px;border-bottom:1px solid #f2ede3;">
          <img src="${logoUrl}" alt="${BRAND}" width="200" height="80"
               style="display:block;width:200px;max-width:60%;height:auto;border:0;outline:none;text-decoration:none;">
        </td></tr>

        <tr><td style="background:#ffffff;padding:32px;">
          <h1 style="margin:0 0 8px;font-size:22px;letter-spacing:0.01em;color:#141414;text-transform:uppercase;">${esc(heading)}</h1>
          <p style="margin:0 0 4px;font-size:13px;color:#8a8577;">Pedido #${order.order_number}</p>
          <p style="margin:16px 0 24px;font-size:15px;line-height:1.6;color:#3f3d38;">
            Olá, ${esc(order.customer_name)}.<br>${esc(intro)}
          </p>
${reasonBlock}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
            ${rows}
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 24px;">
            ${totalRow("Subtotal", formatBRL(order.subtotal))}
            ${totalRow("Entrega", frete)}
            ${totalRow("Total", formatBRL(order.total), true)}
          </table>
${pixBlock}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr>
              <td style="width:50%;vertical-align:top;padding-right:12px;">
                <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8577;margin-bottom:6px;">${order.fulfillment_type === "retirada" ? "Retirada" : "Entrega"}</div>
                <div style="font-size:14px;line-height:1.5;color:#3f3d38;">${formatFulfillment(order)}</div>
              </td>
              <td style="width:50%;vertical-align:top;padding-left:12px;">
                <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8577;margin-bottom:6px;">Pagamento</div>
                <div style="font-size:14px;line-height:1.5;color:#3f3d38;">${esc(pagamento)}</div>
              </td>
            </tr>
          </table>

          <a href="${accountUrl}" style="display:inline-block;background:${accent};color:#f4f2ec;text-decoration:none;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;padding:14px 28px;border-radius:10px;">
            Ver meu pedido
          </a>
        </td></tr>

        <tr><td style="background:#ffffff;border-radius:0 0 14px 14px;padding:24px 32px;border-top:1px solid #eee9df;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#a8a396;">
            Este é um e-mail automático da ${BRAND} sobre o seu pedido.<br>
            Em caso de dúvidas, responda esta mensagem ou fale com a gente pelo WhatsApp.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
