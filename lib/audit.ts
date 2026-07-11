import "server-only";

import { createServiceClient } from "@/lib/supabase/server";

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
  } catch {
    // Auditoria não deve quebrar a operação principal.
  }
}
