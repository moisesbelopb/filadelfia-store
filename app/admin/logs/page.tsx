import { Badge } from "@/components/ui/badge";
import { AUDIT_RETENTION_DAYS } from "@/lib/audit";
import { isNativeAdmin } from "@/lib/auth";
import { getAuditLogs } from "@/lib/queries/audit";
import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Logs de acesso" };

// Sempre dinâmico (dados de auditoria não devem ser cacheados).
export const dynamic = "force-dynamic";

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return { date, time };
}

/** Data de hoje (ou N dias atrás) no fuso de Brasília, formato YYYY-MM-DD. */
function brtDate(offsetDays = 0): string {
  return new Date(Date.now() - offsetDays * 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const brDisplay = (d: string) => d.split("-").reverse().join("/");

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string }>;
}) {
  // Acesso EXCLUSIVO do administrador nativo.
  if (!(await isNativeAdmin())) redirect("/admin");

  const { de = "", ate = "" } = await searchParams;
  // Datas interpretadas no fuso de Brasília (dia inteiro).
  const start = DATE_RE.test(de) ? new Date(`${de}T00:00:00-03:00`).toISOString() : undefined;
  const end = DATE_RE.test(ate) ? new Date(`${ate}T23:59:59.999-03:00`).toISOString() : undefined;
  const filtered = Boolean(start || end);
  const today = brtDate(0);
  const presets = [
    { label: "Hoje", de: today, ate: today },
    { label: "Últimos 7 dias", de: brtDate(6), ate: today },
    { label: "Últimos 30 dias", de: brtDate(29), ate: today },
  ];

  const logs = await getAuditLogs(500, { start, end });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Logs de acesso</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Registro de todas as ações no painel administrativo, por usuário, em ordem cronológica
          (mais recente primeiro). Histórico dos últimos {AUDIT_RETENTION_DAYS} dias. Acesso
          exclusivo do administrador nativo.
        </p>
      </header>

      {/* Filtro por período */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="de" className="text-xs font-medium text-muted-foreground">
              De
            </label>
            <input
              type="date"
              id="de"
              name="de"
              defaultValue={de}
              max={today}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="ate" className="text-xs font-medium text-muted-foreground">
              Até
            </label>
            <input
              type="date"
              id="ate"
              name="ate"
              defaultValue={ate}
              max={today}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <button
            type="submit"
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Filtrar
          </button>
          {filtered && (
            <a
              href="/admin/logs"
              className="inline-flex h-10 items-center px-2 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Limpar
            </a>
          )}
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Atalhos:</span>
          {presets.map((p) => (
            <a
              key={p.label}
              href={`/admin/logs?de=${p.de}&ate=${p.ate}`}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary"
            >
              {p.label}
            </a>
          ))}
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {filtered ? "Nenhuma ação registrada nesse período." : "Nenhuma ação registrada ainda."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left">
                <th className="whitespace-nowrap px-4 py-3 font-medium text-muted-foreground">
                  Data / hora
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Ação</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Usuário</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const { date, time } = formatDateTime(l.createdAt);
                return (
                  <tr key={l.id} className="border-b border-border last:border-0 align-top">
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                      <span className="font-medium">{date}</span>
                      <span className="ml-2 text-muted-foreground">{time}</span>
                    </td>
                    <td className="px-4 py-3">{l.description}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-2 font-medium">
                          {l.actorName}
                          {l.actorRole && (
                            <Badge variant="secondary" className="text-[0.65rem]">
                              {l.actorRole}
                            </Badge>
                          )}
                        </span>
                        {l.actorEmail && (
                          <span className="text-xs text-muted-foreground">{l.actorEmail}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {logs.length} {logs.length === 1 ? "registro" : "registros"}
        {filtered && de && ate
          ? ` · ${brDisplay(de)} a ${brDisplay(ate)}`
          : filtered && de
            ? ` · a partir de ${brDisplay(de)}`
            : filtered && ate
              ? ` · até ${brDisplay(ate)}`
              : ""}{" "}
        · fuso de Brasília (America/Sao_Paulo)
      </p>
    </div>
  );
}
