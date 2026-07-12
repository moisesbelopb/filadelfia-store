import "server-only";

import { createServiceClient } from "@/lib/supabase/server";

/** Histórico de auditoria mantido (dias). Logs mais antigos são descartados. */
export const AUDIT_RETENTION_DAYS = 90;

/** Registra uma ação administrativa em audit_logs (best-effort). */
export async function logAudit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const service = createServiceClient();
    await service.from("audit_logs").insert({
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata: metadata ?? null,
    });
    // Retenção: mantém ~120 dias de histórico (purga junto de cada ação — o
    // volume é baixo e o índice em created_at deixa o delete barato).
    const cutoff = new Date(Date.now() - AUDIT_RETENTION_DAYS * 86_400_000).toISOString();
    await service.from("audit_logs").delete().lt("created_at", cutoff);
  } catch {
    // Auditoria não deve quebrar a operação principal.
  }
}
