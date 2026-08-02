import "server-only";

import { createServiceClient } from "@/lib/supabase/server";

/** Conta de envio Gmail ativa (senha ainda cifrada). */
export interface EmailSender {
  account: string;
  fromName: string;
  port: number;
  appPasswordEnc: string;
}

/**
 * Lê a conta de envio salva no admin (settings.key = 'email_sender'). Retorna
 * null quando desativada (sem conta ou sem senha) — o envio cai no ZeptoMail.
 * Usa service role: a senha de app não é uma configuração pública.
 */
export async function getEmailSender(): Promise<EmailSender | null> {
  try {
    const service = createServiceClient();
    const { data } = await service
      .from("settings")
      .select("value")
      .eq("key", "email_sender")
      .maybeSingle();
    const v = (data?.value ?? null) as {
      account?: string;
      fromName?: string;
      port?: number;
      appPasswordEnc?: string | null;
    } | null;
    if (!v?.account || !v.appPasswordEnc) return null;
    return {
      account: v.account,
      fromName: v.fromName || "Casa de Filadélfia",
      port: Number(v.port) === 587 ? 587 : 465,
      appPasswordEnc: v.appPasswordEnc,
    };
  } catch {
    return null;
  }
}
