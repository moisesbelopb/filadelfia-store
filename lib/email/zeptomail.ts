import "server-only";

import { isZeptomailConfigured } from "@/lib/env";

/**
 * Configuração do ZeptoMail (Zoho). O token e o remetente ficam em env
 * server-only. A URL é sobrescrevível para a região EU
 * (https://api.zeptomail.eu/v1.1/email).
 */
function cfg() {
  return {
    url: (process.env.ZEPTOMAIL_API_URL ?? "https://api.zeptomail.com/v1.1/email").replace(
      /\/+$/,
      "",
    ),
    token: process.env.ZEPTOMAIL_TOKEN ?? "",
    fromEmail: process.env.ZEPTOMAIL_FROM_EMAIL ?? "",
    fromName: process.env.ZEPTOMAIL_FROM_NAME ?? "Casa de Filadélfia",
  };
}

export interface EmailResult {
  ok: boolean;
  status: number;
  data: unknown;
  error?: string;
  /** Metadados seguros para log (nunca inclui o token). */
  request?: Record<string, unknown>;
}

/** Extrai uma mensagem de erro legível da resposta de erro do ZeptoMail. */
function extractError(data: unknown, status: number): string {
  const d = data as {
    message?: string;
    error?: { message?: string; details?: { message?: string }[] };
  } | null;
  const detail = d?.error?.details?.[0]?.message;
  return detail ?? d?.error?.message ?? d?.message ?? `ZeptoMail respondeu ${status}.`;
}

/**
 * Envia um e-mail transacional via ZeptoMail Email API.
 * Corpo conforme a doc oficial (zoho.com/zeptomail/help/api/email-sending):
 * { from:{address,name}, to:[{email_address:{address,name}}], subject, htmlbody }.
 */
export async function sendEmail(params: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
}): Promise<EmailResult> {
  if (!isZeptomailConfigured) {
    return { ok: false, status: 0, data: null, error: "ZeptoMail não configurado." };
  }
  const { url, token, fromEmail, fromName } = cfg();
  const body = {
    from: { address: fromEmail, name: fromName },
    to: [{ email_address: { address: params.to, name: params.toName ?? params.to } }],
    subject: params.subject,
    htmlbody: params.html,
  };
  const request = { to: params.to, subject: params.subject, endpoint: url };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Zoho-enczapikey ${token}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      // Evita travar o checkout se o ZeptoMail estiver lento/indisponível.
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json().catch(() => null);
    return {
      ok: res.ok,
      status: res.status,
      data,
      error: res.ok ? undefined : extractError(data, res.status),
      request,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: e instanceof Error ? e.message : "Erro de rede ao chamar o ZeptoMail.",
      request,
    };
  }
}
