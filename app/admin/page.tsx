import { PeriodFilter } from "@/components/admin/period-filter";
import { OrderStatusBadge } from "@/components/loja/order-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolvePeriod } from "@/lib/dashboard-period";
import { getDashboardData } from "@/lib/queries/admin";
import { type VisitStats, getVisitStats } from "@/lib/queries/analytics";
import { cardHighlight, cn, formatBRL, formatDateTime } from "@/lib/utils";
import {
  ArrowUpRight,
  Ban,
  Banknote,
  BarChart3,
  ChevronRight,
  Clock,
  Eye,
  Inbox,
  PackageCheck,
  PackageX,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";

// Depende do período/searchParams e da data atual — sempre dinâmico.
export const dynamic = "force-dynamic";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const { period: periodRaw, from, to } = await searchParams;
  const range = resolvePeriod(periodRaw, from, to);
  const [dash, visits] = await Promise.all([
    getDashboardData({ start: range.start, end: range.end }),
    getVisitStats({ start: range.start, end: range.end }),
  ]);
  const { counts, revenueExpected, ordersTotal, deliveries, stock, recent } = dash;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="eyebrow">Painel</p>
        <h1 className="section-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {range.label} · {ordersTotal} {ordersTotal === 1 ? "pedido" : "pedidos"}
        </p>
      </div>

      <PeriodFilter basePath="/admin" active={range.period} from={range.from} to={range.to} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Stat
          label="Aguardando"
          value={counts.solicitado}
          icon={Clock}
          tone="warning"
          href="/admin/pedidos?status=solicitado"
        />
        <Stat
          label="Em andamento"
          value={counts.andamento}
          icon={Truck}
          tone="primary"
          href="/admin/pedidos"
        />
        <Stat
          label="Entregas realizadas"
          value={deliveries.count}
          icon={PackageCheck}
          tone="success"
          href="/admin/configuracoes/entrega"
        />
        <Stat
          label="Taxas de entrega (motoboy)"
          value={formatBRL(deliveries.fees)}
          icon={Banknote}
          tone="warning"
          href="/admin/configuracoes/entrega"
        />
        <Stat
          label="Pedidos cancelados"
          value={counts.cancelado}
          icon={Ban}
          tone="danger"
          href="/admin/pedidos?status=cancelado"
        />
        <Stat
          label="Faturamento previsto"
          value={formatBRL(revenueExpected)}
          icon={Wallet}
          tone="primary"
        />
      </div>

      <VisitsCard visits={visits} />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="flex-row items-center justify-between border-b border-border/70 pb-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider">
              Pedidos recentes
            </CardTitle>
            <Link
              href="/admin/pedidos"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Ver todos <ArrowUpRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="pt-4 sm:pt-5">
            {recent.length === 0 ? (
              <EmptyState icon={Inbox} label="Nenhum pedido neste período." />
            ) : (
              <ul className="-mx-2 divide-y divide-border/60">
                {recent.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/admin/pedidos/${o.id}`}
                      className="group flex items-center justify-between gap-3 rounded-md px-2 py-3 transition-colors hover:bg-secondary/50"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium">#{o.order_number}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(o.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-medium tabular-nums">
                          {formatBRL(o.total)}
                        </span>
                        <OrderStatusBadge status={o.status} fulfillment={o.fulfillment_type} />
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex-row items-center justify-between border-b border-border/70 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider">
              <PackageX className="size-4 text-warning" /> Estoque: falta e baixo
            </CardTitle>
            <Link
              href="/admin/produtos?tab=estoque"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Gerenciar <ArrowUpRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="pt-4 sm:pt-5">
            {stock.falta.length === 0 && stock.baixo.length === 0 ? (
              <EmptyState icon={PackageCheck} label="Nenhum item em falta ou com estoque baixo." />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <StockCount
                  label="Em falta"
                  sub="Esgotado"
                  value={stock.falta.length}
                  tone="danger"
                />
                <StockCount
                  label="Estoque mínimo"
                  sub="Até 3 un."
                  value={stock.baixo.length}
                  tone="warning"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Acessos à loja no período. Os nomes espelham o painel da Vercel:
 * Visitors → Visitantes e Page Views → Visualizações de página.
 */
function VisitsCard({ visits }: { visits: VisitStats }) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between border-b border-border/70 pb-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider">
          <BarChart3 className="size-4 text-primary" /> Acessos ao site
        </CardTitle>
        <span className="text-xs text-muted-foreground">no período selecionado</span>
      </CardHeader>
      <CardContent className="pt-4 sm:pt-5">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,240px)_1fr] sm:gap-8">
          <div className="flex gap-6">
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Users className="size-3.5" /> Visitantes
              </span>
              <span className="font-display text-3xl font-semibold tabular-nums">
                {visits.uniques}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Eye className="size-3.5" /> Visualizações de página
              </span>
              <span className="font-display text-3xl font-semibold tabular-nums">
                {visits.views}
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Páginas
            </p>
            {visits.topPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem acessos no período.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {visits.topPages.map((p) => (
                  <li key={p.path} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-mono text-xs text-foreground">
                      {p.path === "/" ? "/ (início)" : p.path}
                    </span>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
                      {p.views}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Contador compacto de estoque: um número grande que leva à aba Estoque. */
function StockCount({
  label,
  sub,
  value,
  tone,
}: {
  label: string;
  sub: string;
  value: number;
  tone: "danger" | "warning";
}) {
  return (
    <Link
      href="/admin/produtos?tab=estoque"
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border border-border bg-background p-3",
        cardHighlight,
      )}
    >
      <span
        className={cn(
          "font-display text-3xl font-semibold tabular-nums",
          tone === "danger" ? "text-destructive" : "text-warning",
        )}
      >
        {value}
      </span>
      <span className="text-xs font-medium uppercase tracking-wider text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </Link>
  );
}

const TONES: Record<"primary" | "success" | "warning" | "danger", string> = {
  primary: "bg-accent text-accent-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/15 text-destructive",
};

function Stat({
  label,
  value,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "success" | "warning" | "danger";
  href?: string;
}) {
  const inner = (
    <Card
      className={cn(
        "h-full",
        // Card fica dentro de um Link (group): destaque no hover e no foco por teclado.
        href &&
          cn(
            cardHighlight,
            "group-focus-visible:z-10 group-focus-visible:border-foreground/20 group-focus-visible:shadow-md motion-safe:group-focus-visible:-translate-y-0.5",
          ),
      )}
    >
      <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <span className={`flex size-10 items-center justify-center rounded-lg ${TONES[tone]}`}>
            <Icon className="size-5" />
          </span>
          {href && (
            <ArrowUpRight className="size-4 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
            {value}
          </p>
          <p className="mt-0.5 truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="group">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function EmptyState({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
