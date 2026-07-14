"use server";

import { SITE_URL, isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
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
const nameField = z
  .string()
  .trim()
  .min(2, "Informe seu nome completo")
  .transform(titleCaseName);

/** E-mail: normalizado em minúsculas e validado. */
const emailField = z.string().trim().toLowerCase().email("E-mail inválido");

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(6, "Senha muito curta"),
});

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Preencha e-mail e senha válidos." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-mail ou senha incorretos." };

  // Administrador entra direto no painel — a menos que tenha vindo de uma
  // página específica (ex.: checkout), que continua tendo prioridade.
  let target = safeRedirectPath(formData.get("redirect") as string);
  if (target === "/" && data.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.role === "admin" || profile?.role === "super_admin") target = "/admin";
  }
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, whatsapp: parsed.data.whatsapp },
      emailRedirectTo: `${SITE_URL}/api/auth/callback`,
    },
  });
  if (error) {
    // Já cadastrado é útil de sinalizar; demais erros ficam genéricos (não vazar detalhes).
    const already = /registered|already|exist/i.test(error.message);
    return {
      error: already
        ? "Este e-mail já está cadastrado. Tente entrar."
        : "Não foi possível criar a conta. Tente novamente.",
    };
  }

  const next = safeRedirectPath(formData.get("redirect") as string, "/?bemvindo=1");
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
    .select("id, role");
  if (error || !data?.length) {
    return { error: "Não foi possível salvar. Tente novamente." };
  }

  // Administrador entra direto no painel (a menos que já haja um destino).
  let target = safeRedirectPath(formData.get("next") as string);
  const role = data[0]?.role as string | undefined;
  if (target === "/" && (role === "admin" || role === "super_admin")) target = "/admin";
  redirect(target);
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
