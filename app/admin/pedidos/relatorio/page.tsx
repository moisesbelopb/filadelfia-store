import { PeriodFilter } from "@/components/admin/period-filter";
import { PrintButton } from "@/components/admin/print-button";
import { ReportCategoryFilter } from "@/components/admin/report-category-filter";
import { ReportExportButton } from "@/components/admin/report-export-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolvePeriod } from "@/lib/dashboard-period";
import { type BreakdownRow, getOrdersBreakdown, listCategories } from "@/lib/queries/admin";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

// Depende do período/searchParams e da data atual — sempre dinâmico.
export const dynamic = "force-dynamic";

export default async function RelatorioPedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; cat?: string }>;
}) {
  const { period: periodRaw, from, to, cat } = await searchParams;
  const range = resolvePeriod(periodRaw, from, to);
  const [report, categories] = await Promise.all([
    getOrdersBreakdown({ start: range.start, end: range.end }, cat),
    listCategories(),
  ]);
  const catName = cat ? categories.find((c) => c.id === cat)?.name : undefined;
  const scope = `${range.label}${catName ? ` · ${catName}` : ""}`;

  const sections = [
    { name: "Produto", rows: report.byProduct },
    { name: "Tamanho", rows: report.bySize },
    { name: "Cor", rows: report.byColor },
    { name: "Pagamento", rows: report.byPayment },
    { name: "Entrega/Retirada", rows: report.byFulfillment },
  ];
  const csvName = `relatorio-itens-${range.from}_${range.to}.csv`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link
            href="/admin/pedidos"
            className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
          >
            <ChevronLeft className="size-4" /> Pedidos
          </Link>
          <h1 className="text-xl font-semibold">Relatório de itens vendidos</h1>
          <p className="text-sm text-muted-foreground print:hidden">
            Quantidades por <strong>produto</strong>, <strong>tamanho</strong> e{" "}
            <strong>cor</strong> em {scope.toLowerCase()}. Considera pedidos não
            cancelados/recusados.
          </p>
          {/* Só na impressão: identifica o recorte no papel. */}
          <p className="hidden text-sm text-muted-foreground print:block">{scope}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <ReportExportButton sections={sections} filename={csvName} />
          <PrintButton />
        </div>
      </div>

      <div className="flex flex-col gap-3 print:hidden">
        <ReportCategoryFilter
          categories={categories}
          current={cat}
          keep={{ period: periodRaw, from, to }}
        />
        <PeriodFilter
          basePath="/admin/pedidos/relatorio"
          active={range.period}
          from={range.from}
          to={range.to}
          params={{ cat }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SummaryTile label="Pedidos no período" value={report.totalOrders} />
        <SummaryTile label="Unidades vendidas" value={report.totalUnits} />
      </div>

      <BreakdownCard title="Por produto" rows={report.byProduct} />
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard title="Por tamanho" rows={report.bySize} />
        <BreakdownCard title="Por cor" rows={report.byColor} />
        <BreakdownCard title="Por forma de pagamento" rows={report.byPayment} />
        <BreakdownCard title="Por entrega/retirada" rows={report.byFulfillment} />
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
    <Card className="print:break-inside-avoid print:border-black/20 print:shadow-none">
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
                  className="pointer-events-none absolute inset-y-1 left-0 rounded bg-primary/10 print:hidden"
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
