import { OrderStatusBadge } from "@/components/loja/order-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/lib/queries/admin";
import { formatBRL, formatDateTime } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronRight,
  Clock,
  Inbox,
  PackageCheck,
  Truck,
  Wallet,
} from "lucide-react";
import Link from "next/link";

export default async function AdminDashboard() {
  const { counts, revenueExpected, lowStock, recent } = await getDashboardData();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="eyebrow">Painel</p>
        <h1 className="section-title">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
          label="Entregues"
          value={counts.entregue}
          icon={PackageCheck}
          tone="success"
          href="/admin/pedidos?status=entregue"
        />
        <Stat
          label="Faturamento previsto"
          value={formatBRL(revenueExpected)}
          icon={Wallet}
          tone="primary"
        />
      </div>

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
              <EmptyState icon={Inbox} label="Nenhum pedido ainda." />
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
                        <OrderStatusBadge status={o.status} />
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
              <AlertTriangle className="size-4 text-warning" /> Estoque baixo
            </CardTitle>
            <Link
              href="/admin/estoque"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Gerenciar <ArrowUpRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="pt-4 sm:pt-5">
            {lowStock.length === 0 ? (
              <EmptyState icon={PackageCheck} label="Nenhum item crítico." />
            ) : (
              <ul className="-mx-2 divide-y divide-border/60">
                {lowStock.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-2 py-3">
                    <span className="min-w-0 truncate text-sm">{p.name}</span>
                    <span className="shrink-0 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-warning">
                      {p.stock} un.
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const TONES: Record<"primary" | "success" | "warning", string> = {
  primary: "bg-accent text-accent-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
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
  tone: "primary" | "success" | "warning";
  href?: string;
}) {
  const inner = (
    <Card
      className={`h-full transition-all duration-200 ${
        href ? "hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-md" : ""
      }`}
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
