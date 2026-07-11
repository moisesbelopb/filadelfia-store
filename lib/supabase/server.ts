import { SUPABASE_ANON_KEY_SAFE, SUPABASE_URL_SAFE } from "@/lib/env";
import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

type CookiesToSet = { name: string; value: string; options?: CookieOptions }[];

/**
 * Client Supabase server-side (Server Components, Server Actions, Route
 * Handlers), com sessão via cookies. Respeita RLS pelo contexto do usuário.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL_SAFE, SUPABASE_ANON_KEY_SAFE, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado de um Server Component: ok ignorar; o middleware renova a sessão.
        }
      },
    },
  });
}

/**
 * Client com service_role — ignora RLS. Use APENAS em código server para
 * operações internas (logs, envio Evolution). Nunca exponha ao browser.
 */
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  }
  return createServerClient(SUPABASE_URL_SAFE, serviceKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

/**
 * Client admin (supabase-js) com service_role — habilita a Admin API
 * (auth.admin.createUser, etc.). Server-only. Ignora RLS.
 */
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  }
  return createSupabaseClient(SUPABASE_URL_SAFE, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
