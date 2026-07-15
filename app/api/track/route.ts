import { createHash } from "node:crypto";
import { isSupabaseConfigured } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";

// Precisa do Node (service role + crypto). Nunca cacheado.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dias de detalhe mantidos (poda ocasional, sem cron). */
const RETENTION_DAYS = 90;

const BOT_RE =
  /bot|crawler|spider|crawl|slurp|facebookexternalhit|bingpreview|headless|monitor|preview|lighthouse|pingdom|uptime|curl|wget|python-requests/i;

/**
 * Registro de visita da loja. Chamado por navigator.sendBeacon do cliente, então
 * é best-effort: qualquer falha responde 204 sem afetar o visitante. O /admin e
 * as rotas de API nunca entram (excluídos aqui e no cliente).
 */
export async function POST(request: Request): Promise<Response> {
  const noop = new Response(null, { status: 204 });
  if (!isSupabaseConfigured) return noop;

  let path = "";
  try {
    const parsed = JSON.parse(await request.text());
    if (typeof parsed?.path === "string") path = parsed.path;
  } catch {
    return noop;
  }

  path = (path.split("?")[0] ?? "").split("#")[0] ?? "";
  if (!path.startsWith("/") || path.startsWith("/admin") || path.startsWith("/api")) return noop;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  path = path.slice(0, 300);

  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOT_RE.test(ua)) return noop;

  // Visitante único: hash anônimo que troca a cada dia (sem cookie, no espírito
  // da LGPD). Não guardamos IP nem user-agent, só o hash.
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "0";
  const day = new Date().toISOString().slice(0, 10);
  const visitorHash = createHash("sha256")
    .update(`${ip}|${ua}|${day}|filadelfia-pv`)
    .digest("hex")
    .slice(0, 32);

  try {
    const service = createServiceClient();
    await service.from("page_views").insert({ path, visitor_hash: visitorHash });
    // Poda rara (~2%): remove detalhes além da retenção, sem depender de cron.
    if (Math.random() < 0.02) {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
      await service.from("page_views").delete().lt("created_at", cutoff);
    }
  } catch {
    // best-effort — nunca falha a resposta ao visitante.
  }

  return noop;
}
