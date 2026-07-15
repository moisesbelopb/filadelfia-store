import { PeriodFilter } from "@/components/admin/period-filter";
import { PrintButton } from "@/components/admin/print-button";
import { Card, CardContent } from "@/components/ui/card";
import type { ResolvedPeriod } from "@/lib/dashboard-period";
import { PAYMENT_NAME } from "@/lib/orders/fsm";
import type { DeliveryReport, DeliveryReportRow } from "@/lib/queries/admin";
import type { Address } from "@/types/db";
import { Banknote, PackageCheck, Wallet } from "lucide-react";
import Link from "next/link";

function formatAddress(a: Address | null): string {
  if (!a) return "—";
  const rua = [a.street, a.number].filter(Boolean).join(", ");
  const linha1 = a.complement ? `${rua} — ${a.complement}` : rua;
  return [linha1, a.neighborhood, [a.city, a.state].filter(Boolean).join("/")]
    .filter(Boolean)
    .join(" · ");
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

/**
 * Relatório das entregas realizadas — controle do repasse ao motoboy.
 * O filtro de período recarrega a página (Links); a aba volta para "Relatórios"
 * por ser a padrão, então o relatório continua visível após filtrar.
 */
export function DeliveryReportView({
  report,
  range,
}: {
  report: DeliveryReport;
  range: ResolvedPeriod;
}) {
  const { rows, totals } = report;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {range.label} · {totals.count}{" "}
          {totals.count === 1 ? "entrega realizada" : "entregas realizadas"}
        </p>
        <PrintButton />
      </div>

      <PeriodFilter
        basePath="/admin/configuracoes/entrega"
        active={range.period}
        from={range.from}
        to={range.to}
      />

      {/* Resumo — o número que importa é o total de taxas a repassar ao motoboy. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <Summary
          icon={PackageCheck}
          tone="success"
          label="Entregas realizadas"
          value={String(totals.count)}
        />
        <Summary
          icon={Banknote}
          tone="warning"
          label="Total de taxas (repassar ao motoboy)"
          value={formatBRL(totals.fees)}
          highlight
        />
        <Summary
          icon={Wallet}
          tone="primary"
          label="Total dos pedidos entregues"
          value={formatBRL(totals.orders)}
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <PackageCheck className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhuma entrega realizada neste período.
            </p>
            <p className="text-xs text-muted-foreground">
              Só entram aqui os pedidos de <strong>entrega</strong> marcados como{" "}
              <strong>entregue</strong>. Retiradas na igreja não contam.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <Th>Pedido</Th>
                  <Th>Cliente</Th>
                  <Th>Endereço</Th>
                  <Th>Pagamento</Th>
                  <Th className="text-right">Valor</Th>
                  <Th className="text-right">Taxa</Th>
                  <Th>Pedido em</Th>
                  <Th>Entregue em</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <DeliveryRow key={r.id} row={r} />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <Td className="whitespace-nowrap" colSpan={5}>
                    Total a repassar ao motoboy
                  </Td>
                  <Td className="whitespace-nowrap text-right text-warning">
                    {formatBRL(totals.fees)}
                  </Td>
                  <Td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      <p className="text-xs text-muted-foreground print:hidden">
        A data usada é a <strong>data da entrega</strong>. Ajuste o período acima para fechar o
        repasse do motoboy (ex.: por semana ou por mês) e use “Imprimir” para levar a lista.
      </p>
    </div>
  );
}

function DeliveryRow({ row }: { row: DeliveryReportRow }) {
  return (
    <tr className="border-b border-border/60 align-top">
      <Td className="whitespace-nowrap font-medium">
        <Link href={`/admin/pedidos/${row.id}`} className="hover:underline">
          #{row.order_number}
        </Link>
      </Td>
      <Td className="whitespace-nowrap">{row.customer_name}</Td>
      <Td className="min-w-[16rem] text-muted-foreground">{formatAddress(row.address)}</Td>
      <Td className="whitespace-nowrap">{PAYMENT_NAME[row.payment_method]}</Td>
      <Td className="whitespace-nowrap text-right tabular-nums">{formatBRL(Number(row.total))}</Td>
      <Td className="whitespace-nowrap text-right font-medium tabular-nums">
        {formatBRL(Number(row.delivery_fee))}
      </Td>
      <Td className="whitespace-nowrap text-muted-foreground">{formatDateTime(row.created_at)}</Td>
      <Td className="whitespace-nowrap text-muted-foreground">
        {formatDateTime(row.delivered_at)}
      </Td>
    </tr>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2.5 font-medium ${className}`}>{children}</th>;
}

function Td({
  children,
  className = "",
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td className={`px-3 py-2.5 ${className}`} colSpan={colSpan}>
      {children}
    </td>
  );
}

const TONES: Record<"primary" | "success" | "warning", string> = {
  primary: "bg-accent text-accent-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
};

function Summary({
  icon: Icon,
  tone,
  label,
  value,
  highlight = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "success" | "warning";
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-warning/40" : undefined}>
      <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
        <span className={`flex size-10 items-center justify-center rounded-lg ${TONES[tone]}`}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-2xl font-semibold tabular-nums sm:text-3xl">
            {value}
          </p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
