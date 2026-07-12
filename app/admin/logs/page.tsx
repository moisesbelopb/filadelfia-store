import { Badge } from "@/components/ui/badge";
import { isNativeAdmin } from "@/lib/auth";
import { AUDIT_RETENTION_DAYS } from "@/lib/audit";
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

export default async function LogsPage() {
  // Acesso EXCLUSIVO do administrador nativo.
  if (!(await isNativeAdmin())) redirect("/admin");

  const logs = await getAuditLogs();

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

      {logs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhuma ação registrada ainda.
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
        {logs.length} {logs.length === 1 ? "registro" : "registros"} · fuso de Brasília
        (America/Sao_Paulo)
      </p>
    </div>
  );
}
