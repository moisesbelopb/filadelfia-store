/**
 * Leitura central de variáveis de ambiente + flags de configuração.
 * Enquanto os serviços não estão configurados, o app roda em "modo vazio":
 * páginas renderizam com estados vazios em vez de quebrar.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Valores usados só para instanciar o client sem lançar erro quando vazio. */
export const SUPABASE_URL_SAFE = SUPABASE_URL || "http://localhost:54321";
export const SUPABASE_ANON_KEY_SAFE = SUPABASE_ANON_KEY || "anon-placeholder";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** ZeptoMail (Zoho) — e-mails transacionais de pedido. Server-only. */
export const isZeptomailConfigured = Boolean(
  process.env.ZEPTOMAIL_TOKEN && process.env.ZEPTOMAIL_FROM_EMAIL,
);
