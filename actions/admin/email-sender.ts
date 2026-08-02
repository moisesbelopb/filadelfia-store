"use server";

import { type ActionResult, fail, ok } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { sendEmail } from "@/lib/email/send";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { emailSenderSchema } from "@/lib/validators/admin";
import { revalidatePath } from "next/cache";

async function guard(): Promise<{ ok: false; error: string } | null> {
  if (!isSupabaseConfigured) return fail("Configure o Supabase.");
  if (!(await isAdminUser())) return fail("Acesso negado.");
  return null;
}

/**
 * Salva a conta de envio (Gmail SMTP) em settings.key='email_sender'. A senha de
 * app é guardada CIFRADA (AES). Conta vazia desativa o Gmail (volta ao ZeptoMail).
 * Senha em branco mantém a que já existe.
 */
export async function saveEmailSender(input: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  const parsed = emailSenderSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { account, appPassword, port } = parsed.data;

  const supabase = await createClient();

  // Conta vazia → desativa (remetente volta pro padrão ZeptoMail).
  if (!account) {
    const value = { provider: "gmail", account: "", port, appPasswordEnc: null };
    const { error } = await supabase
      .from("settings")
      .upsert({ key: "email_sender", value, is_public: false }, { onConflict: "key" });
    if (error) return fail(error.message);
  } else {
    // Senha: nova (se informada) ou mantém a já salva.
    let appPasswordEnc: string | null;
    if (appPassword) {
      appPasswordEnc = encryptSecret(appPassword);
    } else {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "email_sender")
        .maybeSingle();
      appPasswordEnc =
        (data?.value as { appPasswordEnc?: string | null } | null)?.appPasswordEnc ?? null;
      if (!appPasswordEnc) return fail("Informe a Senha de app do Gmail (16 caracteres).");
    }
    const value = {
      provider: "gmail",
      account,
      fromName: "Casa de Filadélfia",
      port,
      appPasswordEnc,
    };
    const { error } = await supabase
      .from("settings")
      .upsert({ key: "email_sender", value, is_public: false }, { onConflict: "key" });
    if (error) return fail(error.message);
  }

  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, "settings.email_sender", "settings", "email_sender");
  revalidatePath("/admin/email");
  return ok(undefined);
}

/** Envia um e-mail de teste para o próprio admin, pelo provedor ativo. */
export async function sendEmailSenderTest(): Promise<ActionResult<string>> {
  const g = await guard();
  if (g) return g;
  const user = await getCurrentUser();
  const to = user?.email;
  if (!to) return fail("Seu usuário não tem e-mail cadastrado.");

  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px">
    <h2 style="margin:0 0 8px">Teste de envio ✔</h2>
    <p style="color:#444">Se você recebeu este e-mail, a <strong>conta de envio está funcionando</strong>. Os avisos automáticos de pedido sairão por ela.</p>
    <p style="color:#999;font-size:12px;margin-top:16px">Casa de Filadélfia · ${now}</p>
  </div>`;
  const result = await sendEmail({
    to,
    toName: (user.user_metadata?.full_name as string) ?? undefined,
    subject: "[TESTE] Conta de envio — Casa de Filadélfia",
    html,
  });
  return result.ok ? ok(to) : fail(result.error ?? "Falha no envio do e-mail de teste.");
}
