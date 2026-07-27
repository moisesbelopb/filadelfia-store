import { PeriodFilter } from "@/components/admin/period-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolvePeriod } from "@/lib/dashboard-period";
import { type BreakdownRow, getOrdersBreakdown } from "@/lib/queries/admin";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

// Depende do período/searchParams e da data atual — sempre dinâmico.
export const dynamic = "force-dynamic";

export default async function RelatorioPedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const { period: periodRaw, from, to } = await searchParams;
  const range = resolvePeriod(periodRaw, from, to);
  const report = await getOrdersBreakdown({ start: range.start, end: range.end });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link
          href="/admin/pedidos"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Pedidos
        </Link>
        <h1 className="text-xl font-semibold">Relatório de itens vendidos</h1>
        <p className="text-sm text-muted-foreground">
          Quantidades por <strong>produto</strong>, <strong>tamanho</strong> e <strong>cor</strong>{" "}
          em {range.label.toLowerCase()}. Considera pedidos não cancelados/recusados.
        </p>
      </div>

      <PeriodFilter
        basePath="/admin/pedidos/relatorio"
        active={range.period}
        from={range.from}
        to={range.to}
      />

      <div className="grid grid-cols-2 gap-3">
        <SummaryTile label="Pedidos no período" value={report.totalOrders} />
        <SummaryTile label="Unidades vendidas" value={report.totalUnits} />
      </div>

      <BreakdownCard title="Por produto" rows={report.byProduct} />
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard title="Por tamanho" rows={report.bySize} />
        <BreakdownCard title="Por cor" rows={report.byColor} />
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  const max = rows.reduce((m, r) => Math.max(m, r.units), 0) || 1;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <span className="text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? "item" : "itens"}
        </span>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-border pb-1.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              <span className="flex-1">Item</span>
              <span className="w-14 text-right">Unid.</span>
              <span className="w-16 text-right">Pedidos</span>
            </div>
            {rows.map((r) => (
              <div
                key={r.label}
                className="relative flex items-center gap-2 border-b border-border/50 py-2 text-sm last:border-0"
              >
                {/* Barra proporcional às unidades (contexto visual rápido). */}
                <div
                  className="pointer-events-none absolute inset-y-1 left-0 rounded bg-primary/10"
                  style={{ width: `${(r.units / max) * 100}%` }}
                />
                <span className="relative flex-1 truncate font-medium">{r.label}</span>
                <span className="relative w-14 text-right font-semibold tabular-nums">
                  {r.units}
                </span>
                <span className="relative w-16 text-right tabular-nums text-muted-foreground">
                  {r.orders}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
