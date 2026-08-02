import "server-only";

import { sendViaGmail } from "@/lib/email/gmail";
import { getEmailSender } from "@/lib/email/sender";
import { type EmailResult, sendEmail as sendViaZepto } from "@/lib/email/zeptomail";

export type { EmailResult };

/**
 * Envia um e-mail pelo provedor ATIVO: Gmail (se uma conta de envio estiver
 * configurada no admin) senão ZeptoMail. Mesma interface de antes — os
 * chamadores (templates, notificações de status) não mudam.
 */
export async function sendEmail(params: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
}): Promise<EmailResult> {
  const sender = await getEmailSender();
  if (sender) return sendViaGmail(params, sender);
  return sendViaZepto(params);
}
