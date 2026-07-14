"use server";

import type { ActionResult } from "@/lib/action-result";
import { authProviders, getCurrentUser } from "@/lib/auth";
import { SITE_URL, isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  accountAddressSchema,
  emailChangeSchema,
  passwordChangeSchema,
  personalSchema,
} from "@/lib/validators/account";
import { revalidatePath } from "next/cache";

const NOT_CONFIGURED = "Serviço indisponível no momento. Tente novamente mais tarde.";
const NOT_LOGGED = "Sessão expirada. Entre novamente.";

/** Nome e WhatsApp. A RLS impede que o cliente altere o próprio papel. */
export async function updatePersonalAction(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return { ok: false, error: NOT_CONFIGURED };

  const parsed = personalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: NOT_LOGGED };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, whatsapp: parsed.data.whatsapp })
    .eq("id", user.id)
    .select("id");

  if (error || !data?.length)
    return { ok: false, error: "Não foi possível salvar. Tente de novo." };

  revalidatePath("/conta");
  return { ok: true, data: undefined };
}

/** Endereço padrão — pré-preenche o checkout e aparece no cadastro do cliente. */
export async function updateAddressAction(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return { ok: false, error: NOT_CONFIGURED };

  const parsed = accountAddressSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Endereço inválido." };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: NOT_LOGGED };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ default_address: parsed.data })
    .eq("id", user.id)
    .select("id");

  if (error || !data?.length)
    return { ok: false, error: "Não foi possível salvar. Tente de novo." };

  revalidatePath("/conta");
  return { ok: true, data: undefined };
}

/**
 * Troca do e-mail de acesso. O Supabase só efetiva a troca DEPOIS que o cliente
 * clica no link de confirmação — até lá o e-mail antigo continua valendo, então
 * não existe risco de perder a conta. Contas do Google não passam por aqui: o
 * e-mail é gerenciado lá.
 */
export async function updateEmailAction(input: unknown): Promise<ActionResult<{ sentTo: string }>> {
  if (!isSupabaseConfigured) return { ok: false, error: NOT_CONFIGURED };

  const parsed = emailChangeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "E-mail inválido." };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: NOT_LOGGED };

  if (authProviders(user).includes("google")) {
    return { ok: false, error: "Sua conta usa o login do Google — o e-mail é gerenciado por lá." };
  }
  if (parsed.data.email === (user.email ?? "").toLowerCase()) {
    return { ok: false, error: "Este já é o seu e-mail atual." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${SITE_URL}/api/auth/callback?flow=email_change` },
  );

  if (error) {
    const taken = /already|registered|exist/i.test(error.message);
    return {
      ok: false,
      error: taken
        ? "Este e-mail já está em uso por outra conta."
        : "Não foi possível enviar a confirmação. Tente de novo.",
    };
  }

  revalidatePath("/conta");
  return { ok: true, data: { sentTo: parsed.data.email } };
}

/** Define ou troca a senha. Funciona também para quem entrou pelo Google. */
export async function updatePasswordAction(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return { ok: false, error: NOT_CONFIGURED };

  const parsed = passwordChangeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Senha inválida." };
  }

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: NOT_LOGGED };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    // A senha nova não pode ser igual à atual (regra do Supabase).
    const same = /same.*password|different.*password/i.test(error.message);
    return {
      ok: false,
      error: same
        ? "A nova senha precisa ser diferente da atual."
        : "Não foi possível alterar a senha. Tente de novo.",
    };
  }

  revalidatePath("/conta");
  return { ok: true, data: undefined };
}
