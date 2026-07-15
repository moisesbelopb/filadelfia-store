import { CancelOrderButton } from "@/components/loja/cancel-order-button";
import { OrderRealtime } from "@/components/loja/order-realtime";
import { OrderStatusBadge } from "@/components/loja/order-status-badge";
import { OrderTimeline } from "@/components/loja/order-timeline";
import { WhatsappShare } from "@/components/loja/whatsapp-share";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SITE_URL } from "@/lib/env";
import { formatScheduled } from "@/lib/orders/delivery";
import { PAYMENT_LABEL } from "@/lib/orders/fsm";
import { getMyOrder } from "@/lib/queries/orders";
import { formatBRL, formatDateTime } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Detalhe do pedido" };

export default async function PedidoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getMyOrder(id);
  if (!order) notFound();

  const addr = order.address;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <OrderRealtime orderId={order.id} />

      <Link
        href="/pedidos"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Meus pedidos
      </Link>

      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Pedido #{order.order_number}</h1>
          <p className="text-xs text-muted-foreground">{formatDateTime(order.created_at)}</p>
        </div>
        <OrderStatusBadge status={order.status} fulfillment={order.fulfillment_type} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acompanhamento</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderTimeline
            status={order.status}
            history={order.order_status_history}
            reason={order.status_reason}
            fulfillment={order.fulfillment_type}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {order.order_items.map((it) => (
            <div key={it.id} className="flex justify-between gap-2 text-sm">
              <span>
                {it.quantity}× {it.product_name}
                {it.variant_size ? ` · Tam. ${it.variant_size}` : ""}
              </span>
              <span className="font-medium">{formatBRL(it.line_total)}</span>
            </div>
          ))}
          <Separator className="my-1" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatBRL(order.subtotal)}</span>
          </div>
          {order.delivery_fee > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Entrega</span>
              <span>{formatBRL(order.delivery_fee)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatBRL(order.total)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entrega e pagamento</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
          <p className="text-foreground">{order.customer_name}</p>
          <p>{order.customer_whatsapp}</p>
          <p className="text-foreground">
            {order.fulfillment_type === "retirada" ? "⛪ Retirada na igreja" : "🛵 Entrega"}
            {order.scheduled_date &&
              ` · ${formatScheduled(order.scheduled_date, order.scheduled_window)}`}
          </p>
          {addr && (
            <>
              <p>
                {addr.street}, {addr.number}
                {addr.complement ? ` — ${addr.complement}` : ""}
              </p>
              <p>
                {addr.neighborhood}, {addr.city}/{addr.state} · {addr.zip}
              </p>
            </>
          )}
          {order.notes && <p className="mt-1 italic">“{order.notes}”</p>}
          <Separator className="my-2" />
          <p>
            Pagamento:{" "}
            <span className="text-foreground">{PAYMENT_LABEL[order.payment_method]}</span> ·{" "}
            {order.payment_status === "pago" ? "Pago" : "Pendente"}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <WhatsappShare
          text={`Conheça a Casa de Filadélfia 🙏\n${SITE_URL}`}
          label="Indicar a loja"
          variant="ghost"
        />
        {order.status === "solicitado" && <CancelOrderButton orderId={order.id} />}
      </div>
    </div>
  );
}
