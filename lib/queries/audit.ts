import "server-only";

import { AUDIT_RETENTION_DAYS } from "@/lib/audit";
import { createServiceClient } from "@/lib/supabase/server";

export interface AuditEntry {
  id: string;
  createdAt: string;
  actorName: string;
  actorEmail: string;
  actorRole: string | null;
  description: string;
}

const SETTINGS_LABELS: Record<string, string> = {
  pix: "Pix",
  delivery: "Entrega",
  visual: "Visual da loja",
  store: "Loja",
  whatsapp: "WhatsApp / Comunicação",
  email: "E-mail",
  pwa: "PWA",
};

/** Descrição em português claro do que foi feito. */
function describe(
  action: string,
  target: string | undefined,
  meta: Record<string, unknown> | null,
): string {
  const t = target ? ` ${target}` : "";
  const reason = meta?.reason ? ` — ${String(meta.reason)}` : "";
  switch (action) {
    case "user.create":
      return `Criou o usuário${t || " (novo)"} (${String(meta?.role ?? "cliente")})`;
    case "user.set_role":
      return `Alterou o papel de${t || " um usuário"} para ${String(meta?.role ?? "?")}`;
    case "user.deactivate":
      return `Desativou o usuário${t || (meta?.email ? ` ${String(meta.email)}` : "")}`;
    case "user.activate":
      return `Reativou o usuário${t || (meta?.email ? ` ${String(meta.email)}` : "")}`;
    case "user.delete": {
      const quem = meta?.role === "cliente" ? "cliente" : "usuário";
      const alvo = String(meta?.name || meta?.email || "removido");
      const n = Number(meta?.ordersDeleted ?? 0);
      const pedidos = n > 0 ? ` (com ${n} ${n === 1 ? "pedido" : "pedidos"} do histórico)` : "";
      return `Excluiu o ${quem} ${alvo}${pedidos}`;
    }
    case "product.create":
      return `Criou o produto${t}`;
    case "product.update":
      return `Editou o produto${t}`;
    case "product.variants":
      return `Atualizou variantes/estoque do produto${t}`;
    case "product.image.hover":
      return `Definiu a imagem de destaque do produto${t}`;
    case "product.delete":
      return `Excluiu o produto ${String(meta?.name ?? "")}`.trim();
    case "stock.adjust":
      return `Ajustou o estoque do produto${t} (${String(meta?.type ?? "")} ${String(
        meta?.quantity ?? "",
      )})`.trim();
    case "category.create":
      return `Criou a categoria${t}`;
    case "category.update":
      return `Editou a categoria${t}`;
    case "category.delete":
      return `Excluiu a categoria${t}`;
    case "order.aceito":
      return `Aceitou o pedido${t}`;
    case "order.em_separacao":
      return `Colocou o pedido${t} em separação`;
    case "order.saiu_entrega":
      return `Marcou o pedido${t} como "saiu para entrega"`;
    case "order.entregue":
      return `Marcou o pedido${t} como entregue`;
    case "order.recusado":
      return `Recusou o pedido${t}${reason}`;
    case "order.cancelado":
      return `Cancelou o pedido${t}${reason}`;
    case "order.paid":
      return `Confirmou o pagamento do pedido${t}`;
  }
  if (action.startsWith("settings.")) {
    const key = action.slice("settings.".length);
    return `Atualizou configurações: ${SETTINGS_LABELS[key] ?? key}`;
  }
  return action;
}

/**
 * Logs de auditoria dentro da janela de retenção, em ordem cronológica decrescente,
 * com o ator (nome/e-mail/papel) e a descrição legível da ação.
 */
export async function getAuditLogs(limit = 500): Promise<AuditEntry[]> {
  let svc: ReturnType<typeof createServiceClient>;
  try {
    svc = createServiceClient();
  } catch {
    return [];
  }

  const cutoff = new Date(Date.now() - AUDIT_RETENTION_DAYS * 86_400_000).toISOString();

  const { data: logs } = await svc
    .from("audit_logs")
    .select("id, actor_id, action, entity_type, entity_id, metadata, created_at")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!logs?.length) return [];

  const idsOf = (type: string) =>
    [
      ...new Set(
        logs
          .filter((l) => l.entity_type === type)
          .map((l) => l.entity_id)
          .filter(Boolean),
      ),
    ] as string[];

  const actorIds = [...new Set(logs.map((l) => l.actor_id).filter(Boolean))] as string[];
  const orderIds = idsOf("order");
  const productIds = idsOf("product");
  const categoryIds = idsOf("category");
  const userTargetIds = idsOf("user");

  // Perfis (nome/papel) dos atores e dos usuários-alvo.
  const profileIds = [...new Set([...actorIds, ...userTargetIds])];
  const { data: profiles } = profileIds.length
    ? await svc.from("profiles").select("id, full_name, role").in("id", profileIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  // E-mails (auth) dos atores.
  const emailById = new Map<string, string>();
  try {
    const { data: users } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of users?.users ?? []) emailById.set(u.id, u.email ?? "");
  } catch {
    // sem e-mails — segue só com o nome
  }

  // Alvos legíveis: nº do pedido, nome do produto/categoria/usuário.
  const orderNum = new Map<string, string>();
  if (orderIds.length) {
    const { data } = await svc.from("orders").select("id, order_number").in("id", orderIds);
    for (const o of data ?? []) orderNum.set(o.id, `#${o.order_number}`);
  }
  const productName = new Map<string, string>();
  if (productIds.length) {
    const { data } = await svc.from("products").select("id, name").in("id", productIds);
    for (const p of data ?? []) productName.set(p.id, p.name);
  }
  const categoryName = new Map<string, string>();
  if (categoryIds.length) {
    const { data } = await svc.from("categories").select("id, name").in("id", categoryIds);
    for (const c of data ?? []) categoryName.set(c.id, c.name);
  }

  const targetOf = (entityType: string | null, entityId: string | null): string | undefined => {
    if (!entityId) return undefined;
    if (entityType === "order") return orderNum.get(entityId);
    if (entityType === "product") return productName.get(entityId);
    if (entityType === "category") return categoryName.get(entityId);
    if (entityType === "user") return profileById.get(entityId)?.full_name ?? undefined;
    return undefined;
  };

  return logs.map((l) => {
    const p = l.actor_id ? profileById.get(l.actor_id) : undefined;
    return {
      id: l.id as string,
      createdAt: l.created_at as string,
      actorName: p?.full_name ?? "—",
      actorEmail: (l.actor_id && emailById.get(l.actor_id)) || "",
      actorRole: p?.role ?? null,
      description: describe(
        l.action as string,
        targetOf(l.entity_type as string | null, l.entity_id as string | null),
        (l.metadata as Record<string, unknown> | null) ?? null,
      ),
    };
  });
}
