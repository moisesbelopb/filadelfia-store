import { OrderStatusBadge } from "@/components/loja/order-status-badge";
import { ProductThumb } from "@/components/loja/product-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatScheduled } from "@/lib/orders/delivery";
import { paymentLabel, statusHeadline } from "@/lib/orders/fsm";
import type { MyOrder } from "@/lib/queries/orders";
import { cn, formatBRL } from "@/lib/utils";
import type { PaymentMethod } from "@/types/db";
import {
  Banknote,
  ChevronRight,
  Church,
  CreditCard,
  MapPin,
  QrCode,
  Truck,
} from "lucide-react";
import Link from "next/link";
import type { ElementType, ReactNode } from "react";

const PAYMENT_ICON: Record<PaymentMethod, ElementType> = {
  pix: QrCode,
  dinheiro: Banknote,
  cartao: CreditCard,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Card de pedido da tela "Meus pedidos".
 *
 * Segue o que a pesquisa da Baymard aponta e o que Mercado Livre/Amazon fazem:
 * as informações essenciais ficam no PRÓPRIO card (metade dos usuários entra só
 * para acompanhar), com foto do produto, uma frase dizendo o que está
 * acontecendo, a data prevista e a forma de pagamento — sem precisar clicar.
 */
export function OrderCard({ order }: { order: MyOrder }) {
  const items = order.order_items ?? [];
  const first = items[0];
  const totalUnits = items.reduce((acc, i) => acc + i.quantity, 0);
  const extra = Math.max(0, items.length - 3);

  const isPickup = order.fulfillment_type === "retirada";
  const scheduled = order.scheduled_date
    ? formatScheduled(order.scheduled_date, order.scheduled_window)
    : null;
  const paid = order.payment_status === "pago";
  const PayIcon = PAYMENT_ICON[order.payment_method];
  const showReason =
    (order.status === "cancelado" || order.status === "recusado") && order.status_reason;

  return (
    <article className="relative overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-foreground/20">
      {/* 1) O que está acontecendo com o pedido */}
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-secondary/30 px-4 py-3">
        <div className="min-w-0">
          <OrderStatusBadge status={order.status} />
          <p className="mt-1.5 text-sm font-medium">
            {statusHeadline(order.status, order.fulfillment_type)}
          </p>
          {showReason && (
            <p className="mt-0.5 text-xs text-muted-foreground">Motivo: {order.status_reason}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums">#{order.order_number}</p>
          <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
        </div>
      </header>

      {/* 2) Itens, com foto — o cliente reconhece o pedido de relance */}
      {first && (
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex shrink-0 -space-x-3">
            {items.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="relative size-14 shrink-0 overflow-hidden rounded-lg border-2 border-card bg-secondary"
              >
                <ProductThumb name={item.product_name} path={item.image} sizes="56px" />
              </div>
            ))}
            {extra > 0 && (
              <div className="relative flex size-14 shrink-0 items-center justify-center rounded-lg border-2 border-card bg-secondary text-xs font-semibold text-muted-foreground">
                +{extra}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{first.product_name}</p>
            <p className="text-xs text-muted-foreground">
              {first.variant_size ? `Tam. ${first.variant_size} · ` : ""}
              {totalUnits} {totalUnits === 1 ? "peça" : "peças"}
              {items.length > 1 && ` · ${items.length} itens`}
            </p>
          </div>
        </div>
      )}

      {/* 3) Como recebe e COMO PAGA (a forma de pagamento fica visível na lista) */}
      <dl className="grid gap-3 border-t border-border px-4 py-3 sm:grid-cols-2">
        <Info
          icon={isPickup ? Church : Truck}
          label={isPickup ? "Retirada na igreja" : "Entrega"}
          value={scheduled ?? (isPickup ? "A combinar" : "No seu endereço")}
        />
        <Info
          icon={PayIcon}
          label="Forma de pagamento"
          value={paymentLabel(order.payment_method, order.fulfillment_type)}
          badge={
            <Badge variant={paid ? "success" : "warning"} className="text-[0.65rem]">
              {paid ? "Pago" : "A pagar"}
            </Badge>
          }
        />
        {!isPickup && order.address && (
          <div className="sm:col-span-2">
            <Info
              icon={MapPin}
              label="Endereço"
              value={`${order.address.street}, ${order.address.number} · ${order.address.neighborhood} · ${order.address.city}/${order.address.state}`}
            />
          </div>
        )}
      </dl>

      {/* 4) Total + ação (o link cobre o card inteiro, mas continua sendo 1 link só) */}
      <footer className="flex items-center justify-between gap-3 border-t border-border bg-secondary/20 px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-bold tabular-nums">{formatBRL(order.total)}</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link
            href={`/pedidos/${order.id}`}
            className="after:absolute after:inset-0 after:content-['']"
          >
            Ver detalhes <ChevronRight className="size-4" />
          </Link>
        </Button>
      </footer>
    </article>
  );
}

function Info({
  icon: Icon,
  label,
  value,
  badge,
}: {
  icon: ElementType;
  label: string;
  value: string;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className={cn("flex flex-wrap items-center gap-1.5 text-sm font-medium")}>
          <span className="break-words">{value}</span>
          {badge}
        </dd>
      </div>
    </div>
  );
}
