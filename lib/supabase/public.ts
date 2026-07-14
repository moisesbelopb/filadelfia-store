import "server-only";

import { SUPABASE_ANON_KEY_SAFE, SUPABASE_URL_SAFE } from "@/lib/env";
import { createClient } from "@supabase/supabase-js";

/**
 * Client anônimo SEM cookies — para dados públicos (catálogo, settings públicos).
 *
 * Dois motivos:
 *  1) Não toca em `cookies()`, então não força a página a render dinâmico e o
 *     resultado pode entrar no cache (`unstable_cache`).
 *  2) Sem sessão, a RLS o trata como anônimo: só enxerga produtos/categorias
 *     ativos e `settings` marcados como `is_public`. É a mesma visão de um
 *     visitante deslogado — nada sensível passa por aqui.
 */
export function createPublicClient() {
  return createClient(SUPABASE_URL_SAFE, SUPABASE_ANON_KEY_SAFE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
