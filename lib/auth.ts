import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/db";
import type { User } from "@supabase/supabase-js";

/** Usuário autenticado (ou null). */
export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Profile do usuário atual (papel, nome, whatsapp). */
export async function getProfile(): Promise<Profile | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile | null) ?? null;
}

/**
 * Provedores de login vinculados à conta (ex.: ["email"], ["google"]).
 * Quem entrou pelo Google não tem senha nem controla o e-mail por aqui.
 */
export function authProviders(user: User): string[] {
  const meta = user.app_metadata as { provider?: string; providers?: string[] };
  const list = meta?.providers ?? (meta?.provider ? [meta.provider] : []);
  return list.map((p) => p.toLowerCase());
}

/** True se o usuário atual é admin/super_admin. */
export async function isAdminUser(): Promise<boolean> {
  const profile = await getProfile();
  return profile?.role === "admin" || profile?.role === "super_admin";
}

/** True se o usuário atual é super administrador. */
export async function isSuperAdmin(): Promise<boolean> {
  const profile = await getProfile();
  return profile?.role === "super_admin";
}

/** E-mail do DONO do sistema no bootstrap (fallback quando a flag não existe). */
export const NATIVE_ADMIN_EMAIL = (
  process.env.NATIVE_ADMIN_EMAIL ?? "casadefiladelfia@gmail.com"
).toLowerCase();

/**
 * True se o usuário é o DONO (administrador nativo). A identidade NÃO depende do
 * e-mail: a flag app_metadata.is_owner sobrevive a trocas de e-mail. O e-mail do
 * bootstrap (NATIVE_ADMIN_EMAIL) é só o fallback enquanto a flag ainda não foi
 * gravada — assim a proteção funciona já na primeira execução.
 */
export function isOwnerUser(
  user: Pick<User, "email" | "app_metadata"> | null | undefined,
): boolean {
  if (!user) return false;
  if ((user.app_metadata as { is_owner?: boolean } | undefined)?.is_owner === true) return true;
  return (user.email ?? "").toLowerCase() === NATIVE_ADMIN_EMAIL;
}

/** True apenas para o dono do sistema (sessão atual). */
export async function isOwner(): Promise<boolean> {
  return isOwnerUser(await getCurrentUser());
}

/** Alias histórico — o "administrador nativo" é o dono. Usado nos logs de acesso. */
export async function isNativeAdmin(): Promise<boolean> {
  return isOwner();
}

/**
 * Destino após o login. Administrador cai direto no painel — inclusive quando
 * veio de uma página protegida (ex.: clicou em "Minha conta" e foi mandado ao
 * login). A ÚNICA exceção é o fluxo de compra: se estava indo para o carrinho
 * ou o checkout, respeitamos o destino para não interromper o pedido.
 *
 * Consulta o papel com a service role: não depende de a sessão recém-criada já
 * estar visível no client desta requisição.
 */
export async function resolvePostLoginPath(userId: string, requested: string): Promise<string> {
  if (requested.startsWith("/carrinho") || requested.startsWith("/checkout")) return requested;

  try {
    const admin = createAdminClient();
    const { data } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
    const role = data?.role as string | undefined;
    if (role === "admin" || role === "super_admin") return "/admin";
  } catch {
    // Sem service role configurada: segue para o destino pedido.
  }
  return requested;
}
