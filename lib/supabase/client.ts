import { SUPABASE_ANON_KEY_SAFE, SUPABASE_URL_SAFE } from "@/lib/env";
import { createBrowserClient } from "@supabase/ssr";

/** Client Supabase para uso no browser (Client Components). */
export function createClient() {
  return createBrowserClient(SUPABASE_URL_SAFE, SUPABASE_ANON_KEY_SAFE);
}
