import { SITE_URL } from "@/lib/env";
import { formatBRL } from "@/lib/utils";

const BRAND = "Casa de Filadélfia";
const ACCENT = "#a9772b";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface CartReminderItem {
  name: string;
  size: string | null;
  quantity: number;
  lineTotal: number;
}

/**
 * E-mail de carrinho abandonado — mesmo visual dos e-mails da loja, com destaque
 * dourado (convite pra voltar). Copy gentil com técnicas de recuperação de venda.
 */
export function renderCartReminderEmail(
  customerName: string,
  items: CartReminderItem[],
  subtotal: number,
): { subject: string; html: string } {
  const firstName = customerName.trim().split(/\s+/)[0] || "cliente";
  const subject = `${firstName}, seus itens ainda estão te esperando`;
  const cartUrl = `${SITE_URL}/carrinho`;
  const logoUrl = `${SITE_URL}/logo.png`;

  const rows = items
    .map(
      (i) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #eee9df;font-size:14px;color:#141414;">
            ${esc(i.name)}${i.size ? `<span style="color:#8a8577;"> · ${esc(i.size)}</span>` : ""}<span style="color:#8a8577;">&nbsp;×&nbsp;${i.quantity}</span>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #eee9df;font-size:14px;color:#141414;text-align:right;white-space:nowrap;">
            ${formatBRL(i.lineTotal)}
          </td>
        </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f2ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Seus itens continuam guardados no carrinho — finalize quando quiser.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ec;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <tr><td style="background:${ACCENT};border-radius:14px 14px 0 0;height:6px;line-height:6px;font-size:0;">&nbsp;</td></tr>

        <tr><td align="center" style="background:#ffffff;padding:28px 32px 4px;border-bottom:1px solid #f2ede3;">
          <img src="${logoUrl}" alt="${BRAND}" width="200" height="80"
               style="display:block;width:200px;max-width:60%;height:auto;border:0;outline:none;text-decoration:none;">
        </td></tr>

        <tr><td style="background:#ffffff;padding:32px;">
          <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:${ACCENT};font-weight:700;">Seu carrinho está reservado</p>
          <h1 style="margin:0 0 16px;font-size:21px;letter-spacing:0.01em;color:#141414;text-transform:uppercase;">Você esqueceu algo especial</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3f3d38;">
            Olá, ${esc(firstName)}. Você escolheu alguns itens aqui na ${BRAND}, mas ainda não concluiu o pedido. Ficou tudo guardado no seu carrinho — é só finalizar quando quiser.
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;">
            ${rows}
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
            <tr>
              <td style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#8a8577;">Subtotal no carrinho</td>
              <td style="font-size:18px;font-weight:700;color:#141414;text-align:right;white-space:nowrap;">${formatBRL(subtotal)}</td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="background:#faf7f0;border:1px solid #e6ddcb;border-radius:12px;padding:20px 22px;">
              <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${ACCENT};font-weight:700;margin-bottom:8px;">Estoque limitado</div>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#3f3d38;">
                Seus itens continuam separados no carrinho, mas o estoque é limitado e eles podem acabar. Que tal garantir os seus agora? A finalização leva menos de 1 minuto.
              </p>
            </td></tr>
          </table>

          <div style="text-align:center;margin:4px 0 22px;">
            <a href="${cartUrl}" style="display:inline-block;background:${ACCENT};color:#fdfbf5;text-decoration:none;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;font-weight:600;padding:15px 34px;border-radius:11px;">
              Finalizar meu pedido
            </a>
          </div>

          <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#3f3d38;text-align:center;">
            Ficou com alguma dúvida? É só responder este e-mail ou chamar a gente no WhatsApp — estamos aqui pra ajudar você.
          </p>
          <p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:#3f3d38;">
            Com carinho,<br><strong style="color:#141414;">Equipe ${BRAND}</strong>
          </p>
        </td></tr>

        <tr><td style="background:#ffffff;border-radius:0 0 14px 14px;padding:24px 32px;border-top:1px solid #eee9df;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#a8a396;">
            Você recebeu este lembrete porque tem itens no carrinho da ${BRAND}. Se já concluiu ou não deseja mais, é só ignorar esta mensagem.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
