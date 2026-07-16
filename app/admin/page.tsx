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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
          {/* Métricas em blocos: número grande com o rótulo abaixo.
              self-start: não estica junto com o painel de páginas. */}
          <div className="grid grid-cols-2 gap-3 self-start">
            <Metric icon={Users} label="Visitantes" value={visits.uniques} />
            <Metric icon={Eye} label="Visualizações de página" value={visits.views} />
          </div>

          {/* Painel de páginas: cabeçalho de colunas + linhas com barra. */}
          <div className="min-w-0 rounded-xl border border-border p-4">
            <p className="text-sm font-semibold uppercase tracking-wider">Páginas</p>
            {visits.topPages.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Sem acessos no período.</p>
            ) : (
              <>
                <div className="mt-3 flex items-center justify-between gap-3 border-y border-border py-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Página
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Visualizações
                  </span>
                </div>
                <PagesBars pages={visits.topPages} />
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Um número de acesso (visitantes / visualizações) com rótulo abaixo. */
function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-background p-3">
      <span className="font-display text-3xl font-semibold tabular-nums">{value}</span>
      {/* Fonte menor e tracking curto: "VISUALIZAÇÕES" cabe inteira na linha
          (antes quebrava no meio da palavra). min-w-0 + break-words seguram
          qualquer rótulo maior sem vazar do bloco. */}
      <span className="flex items-start gap-1 text-[0.65rem] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
        <Icon className="mt-px size-3 shrink-0" />
        <span className="min-w-0 break-words">{label}</span>
      </span>
    </div>
  );
}

/**
 * Nome legível da página para o lojista (em vez do caminho técnico).
 * Caminhos desconhecidos caem no próprio caminho — melhor mostrar o cru do que
 * inventar um nome errado.
 */
function pageLabel(path: string): string {
  if (path === "/") return "Página inicial do site";
  if (path === "/conta") return "Login de acesso na conta";
  if (path === "/carrinho") return "Carrinho de compras";
  if (path === "/checkout") return "Finalização do pedido";
  if (path === "/pedidos") return "Meus pedidos";
  if (path.startsWith("/pedidos/")) return "Detalhe de um pedido";
  if (path === "/privacidade") return "Política de privacidade";
  if (path.startsWith("/produtos/")) {
    const slug = path.slice("/produtos/".length).replace(/-/g, " ").trim();
    return slug ? `Produto: ${slug}` : "Página de produto";
  }
  return path;
}

/**
 * Linhas das páginas: nome · barra proporcional · nº de visualizações.
 * A barra fica entre o nome e o número (trilha + preenchimento); no mobile ela
 * sai de cena para o nome e o número respirarem.
 */
function PagesBars({ pages }: { pages: VisitStats["topPages"] }) {
  const max = Math.max(1, ...pages.map((p) => p.views));
  return (
    <ul className="divide-y divide-border">
      {pages.map((p) => (
        <li key={p.path} className="flex items-center gap-3 py-3 sm:gap-4">
          {/* title: mantém o caminho real acessível ao passar o mouse. */}
          <span
            title={p.path}
            className="min-w-0 flex-1 truncate text-sm text-foreground sm:w-52 sm:flex-none"
          >
            {pageLabel(p.path)}
          </span>
          <div
            aria-hidden
            className="hidden h-2 flex-1 overflow-hidden rounded-full bg-secondary sm:block"
          >
            <div
              className="h-full rounded-full bg-foreground/25"
              style={{ width: `${(p.views / max) * 100}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">
            {p.views}
          </span>
        </li>
      ))}
    </ul>
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
