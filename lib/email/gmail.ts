import "server-only";

import { decryptSecret } from "@/lib/crypto";
import type { EmailSender } from "@/lib/email/sender";
import type { EmailResult } from "@/lib/email/zeptomail";
import nodemailer from "nodemailer";

/**
 * Envia um e-mail via SMTP do Gmail (nodemailer), usando a conta configurada no
 * admin. O Gmail força o remetente para a conta autenticada (não dá pra forjar
 * outro endereço). Limite ~500/dia numa conta gratuita.
 */
export async function sendViaGmail(
  params: { to: string; toName?: string; subject: string; html: string },
  sender: EmailSender,
): Promise<EmailResult> {
  const request = {
    to: params.to,
    subject: params.subject,
    endpoint: "smtp.gmail.com",
    from: sender.account,
  };

  let pass: string;
  try {
    pass = decryptSecret(sender.appPasswordEnc);
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      error: "Falha ao decifrar a senha de app.",
      request,
    };
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: sender.port,
    secure: sender.port === 465,
    auth: { user: sender.account, pass },
  });

  try {
    const info = await transporter.sendMail({
      from: { name: sender.fromName, address: sender.account },
      to: params.toName ? { name: params.toName, address: params.to } : params.to,
      subject: params.subject,
      html: params.html,
    });
    return {
      ok: true,
      status: 200,
      data: { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected },
      request,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: e instanceof Error ? e.message : "Erro no envio SMTP (Gmail).",
      request,
    };
  }
}
