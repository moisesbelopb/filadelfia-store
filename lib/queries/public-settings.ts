import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";
import type { VisualSettings } from "@/lib/theme";
import type { DeliverySettings } from "@/types/db";
import { unstable_cache } from "next/cache";

/** Tag de invalidação: as actions do admin chamam revalidateTag(SETTINGS_TAG). */
export const SETTINGS_TAG = "settings-publicas";

async function readPublicSetting<T>(key: string): Promise<T | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = createPublicClient();
  const { data } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T | undefined) ?? null;
}

/**
 * Tema da loja. Lido no layout, ou seja, em TODA página — por isso é cacheado:
 * antes, essa consulta ia ao banco a cada request e, por usar cookies, ainda
 * forçava a loja inteira a render dinâmico.
 */
export const getVisualSettings = unstable_cache(
  () => readPublicSetting<VisualSettings>("visual"),
  ["settings:visual"],
  { tags: [SETTINGS_TAG], revalidate: 3600 },
);

/** Regras de entrega/retirada (cidades, taxas, agenda). */
export const getDeliverySettings = unstable_cache(
  () => readPublicSetting<DeliverySettings>("delivery"),
  ["settings:delivery"],
  { tags: [SETTINGS_TAG], revalidate: 3600 },
);
