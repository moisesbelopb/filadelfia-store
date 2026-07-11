import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
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

/** True se o usuário atual é admin/super_admin. */
export async function isAdminUser(): Promise<boolean> {
  const profile = await getProfile();
  return profile?.role === "admin" || profile?.role === "super_admin";
}
