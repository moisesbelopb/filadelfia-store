import { OrderActions } from "@/components/admin/order-actions";
import { OrderRealtime } from "@/components/loja/order-realtime";
import { OrderStatusBadge } from "@/components/loja/order-status-badge";
import { OrderTimeline } from "@/components/loja/order-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { notificationEventLabel } from "@/lib/email/defaults";
import { formatScheduled } from "@/lib/orders/delivery";
import { PAYMENT_LABEL } from "@/lib/orders/fsm";
import { pixMessage, whatsappLink } from "@/lib/orders/template";
import { getAdminOrder, getMessageTemplate, getSetting } from "@/lib/queries/admin";
import { formatBRL, formatDateTime } from "@/lib/utils";
import type { NotificationStatus, PixSettings } from "@/types/db";
import { ChevronLeft, MessageCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

/** Status da notificação em linguagem clara + cor do selo. */
const NOTIFICATION_STATUS: Record<
  NotificationStatus,
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  enviado: { label: "Enviado", variant: "success" },
  pendente: { label: "Pendente", variant: "warning" },
  erro: { label: "Falhou", variant: "destructive" },
};

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ order, logs }, template, pix] = await Promise.all([
    getAdminOrder(id),
    getMessageTemplate("pix"),
    getSetting<PixSettings>("pix"),
  ]);
  if (!order) notFound();

  const addr = order.address;
  const isPix = order.payment_method === "pix";
  const waMessage = isPix
    ? pixMessage(order, pix, template?.body)
    : `Olá ${order.customer_name}! Aqui é da Casa de Filadélfia sobre o seu pedido #${order.order_number}.`;
  const waHref = whatsappLink(order.customer_whatsapp, waMessage);
  const pixKeyMissing = isPix && !pix?.chave;
  const isPickup = order.fulfillment_type === "retirada";
  const cardMachine = order.payment_method === "cartao" && !isPickup;

  return (
    <div className="flex flex-col gap-4">
      <OrderRealtime orderId={order.id} />

      <Link
        href="/admin/pedidos"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Pedidos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Pedido #{order.order_number}</h1>
          <p className="text-xs text-muted-foreground">{formatDateTime(order.created_at)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ações</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderActions
            orderId={order.id}
            status={order.status}
            paymentStatus={order.payment_status}
          />
          {order.status_reason && (
            <p className="mt-3 text-sm text-muted-foreground">Motivo: {order.status_reason}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cliente e entrega</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p className="text-foreground">{order.customer_name}</p>
            <p>{order.customer_whatsapp}</p>
            <p className="text-foreground">
              {isPickup ? "⛪ Retirada na igreja" : "🛵 Entrega"}
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
            <div className="flex flex-wrap items-center gap-2">
              <span>{PAYMENT_LABEL[order.payment_method]}</span>
              <Badge variant={order.payment_status === "pago" ? "success" : "warning"}>
                {order.payment_status === "pago" ? "Pago" : "Pendente"}
              </Badge>
              {cardMachine && <Badge variant="warning">Levar maquineta</Badge>}
            </div>

            <Button asChild variant="success" className="mt-3 w-fit">
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" /> Falar no WhatsApp
              </a>
            </Button>
            <p className="mt-1 text-xs">
              {isPix
                ? "Abre a conversa com a cobrança do Pix já escrita."
                : "Abre a conversa com o cliente."}
            </p>
            {pixKeyMissing && (
              <p className="mt-1 w-fit rounded-md bg-warning/10 px-2 py-1 text-xs text-warning-foreground">
                ⚠ Defina a chave Pix em Comunicação para ela entrar na mensagem.
              </p>
            )}
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
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatBRL(order.total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderTimeline
            status={order.status}
            history={order.order_status_history}
            reason={order.status_reason}
          />
        </CardContent>
      </Card>

      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Avisos enviados ao cliente</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {logs.map((log) => {
              const st = NOTIFICATION_STATUS[log.status];
              const canal = log.channel === "email" ? "e-mail" : "WhatsApp";
              return (
                <div key={log.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{notificationEventLabel(log.template_key)}</p>
                    <p className="text-xs text-muted-foreground">
                      Por {canal} · {formatDateTime(log.created_at)}
                    </p>
                  </div>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
