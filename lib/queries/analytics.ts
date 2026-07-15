import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
import type { DashboardRange } from "@/lib/queries/admin";
import { createClient } from "@/lib/supabase/server";

export interface VisitStats {
  views: number;
  uniques: number;
  topPages: { path: string; views: number }[];
}

const EMPTY: VisitStats = { views: 0, uniques: 0, topPages: [] };

/**
 * Acessos da loja no período (visitas, visitantes únicos e páginas mais
 * acessadas). Agregado no banco pela função get_visit_stats (respeita RLS: só
 * admin obtém dados). Falha silenciosa devolve zeros — assim o Dashboard nunca
 * quebra caso a migração 0010 ainda não tenha sido aplicada.
 */
export async function getVisitStats(range?: DashboardRange): Promise<VisitStats> {
  if (!isSupabaseConfigured || !range) return EMPTY;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_visit_stats", {
      p_start: range.start,
      p_end: range.end,
    });
    if (error || !data) return EMPTY;
    const d = data as Partial<VisitStats>;
    return {
      views: d.views ?? 0,
      uniques: d.uniques ?? 0,
      topPages: Array.isArray(d.topPages) ? d.topPages : [],
    };
  } catch {
    return EMPTY;
  }
}
