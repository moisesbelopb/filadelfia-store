"use server";

import { resolvePostLoginPath } from "@/lib/auth";
import { SITE_URL, isSupabaseConfigured } from "@/lib/env";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isValidPhone, maskPhone, safeRedirectPath, titleCaseName } from "@/lib/utils";
import { redirect } from "next/navigation";
import { z } from "zod";

export type AuthState = { error?: string } | undefined;

const NOT_CONFIGURED = "Autenticação indisponível: configure o Supabase em .env.local.";

// --- Campos padronizados (o servidor normaliza; não confia só no navegador) ---

/** WhatsApp: exige DDD + número (10 ou 11 dígitos) e salva como (DD) XXXXX-XXXX. */
const whatsappField = z
  .string()
  .trim()
  .refine(isValidPhone, "WhatsApp inválido — use (DD) 9XXXX-XXXX")
  .transform(maskPhone);

/** Nome próprio: salva com a primeira letra de cada palavra em maiúscula. */
const nameField = z.string().trim().min(2, "Informe seu nome completo").transform(titleCaseName);

/** E-mail: normalizado em minúsculas e validado. */
const emailField = z.string().trim().toLowerCase().email("E-mail inválido");

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(6, "Senha muito curta"),
});

/**
 * Conta criada só com Google NÃO tem senha — o login por e-mail/senha falha com
 * "credenciais inválidas". Detecta esse caso (via service role, só no caminho de
 * ERRO, que é raro) para orientar o cliente a usar o botão "Entrar com Google",
 * em vez do enganoso "e-mail ou senha incorretos".
 */
async function isGoogleOnlyAccount(email: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = data?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
    if (!user) return false;
    const providers =
      (user.app_metadata?.providers as string[] | undefined) ??
      (user.app_metadata?.provider ? [user.app_metadata.provider as string] : []);
    return providers.includes("google") && !providers.includes("email");
  } catch {
    return false;
  }
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Preencha e-mail e senha válidos." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      error: (await isGoogleOnlyAccount(parsed.data.email))
        ? "Esta conta foi criada com o Google. Toque em “Entrar com Google” acima."
        : "E-mail ou senha incorretos.",
    };
  }

  const requested = safeRedirectPath(formData.get("redirect") as string);
  const target = data.user ? await resolvePostLoginPath(data.user.id, requested) : requested;
  redirect(target);
}

const signupSchema = z.object({
  fullName: nameField,
  whatsapp: whatsappField,
  email: emailField,
  password: z.string().min(6, "A senha precisa de ao menos 6 caracteres"),
});

export async function signupAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };

  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    whatsapp: formData.get("whatsapp"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // Cria a conta JÁ confirmada (service role). Sem isso, a confirmação de e-mail
  // do Supabase deixa a conta pendente e BLOQUEIA o login — e o e-mail não é o
  // canal de contato da loja (usamos WhatsApp). O perfil (nome/WhatsApp) e o role
  // 'cliente' saem do trigger on_auth_user_created a partir do user_metadata.
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "Não foi possível criar a conta. Tente novamente." };
  }

  const { error: createErr } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName, whatsapp: parsed.data.whatsapp },
  });
  if (createErr) {
    // Já cadastrado é útil de sinalizar; demais erros ficam genéricos (não vazar detalhes).
    const already = /registered|already|exist/i.test(createErr.message);
    return {
      error: already
        ? "Este e-mail já está cadastrado. Tente entrar."
        : "Não foi possível criar a conta. Tente novamente.",
    };
  }

  // Loga em seguida para já entrar na loja (estabelece a sessão via cookies).
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  const next = safeRedirectPath(formData.get("redirect") as string, "/?bemvindo=1");
  // Conta criada; se o auto-login falhar, manda para o /login já com o destino.
  if (signInErr) redirect(`/login?redirect=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function googleSignInAction(formData: FormData): Promise<void> {
  const next = safeRedirectPath(formData.get("redirect") as string);
  if (!isSupabaseConfigured) {
    redirect(`/login?authError=config&redirect=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${SITE_URL}/api/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data?.url) {
    redirect(`/login?authError=google&redirect=${encodeURIComponent(next)}`);
  }
  redirect(data.url);
}

const completeProfileSchema = z.object({
  fullName: nameField,
  whatsapp: whatsappField,
});

/** Completa o cadastro (WhatsApp) — usado após login social sem WhatsApp. */
export async function completeProfileAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = completeProfileSchema.safeParse({
    fullName: formData.get("fullName"),
    whatsapp: formData.get("whatsapp"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, whatsapp: parsed.data.whatsapp })
    .eq("id", user.id)
    .select("id");
  if (error || !data?.length) {
    return { error: "Não foi possível salvar. Tente novamente." };
  }

  const requested = safeRedirectPath(formData.get("next") as string);
  redirect(await resolvePostLoginPath(user.id, requested));
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
