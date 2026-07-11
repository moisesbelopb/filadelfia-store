import { OrderStatusBadge } from "@/components/loja/order-status-badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getMyOrders } from "@/lib/queries/orders";
import { formatBRL, formatDateTime } from "@/lib/utils";
import { ClipboardList, LogIn } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Meus pedidos" };

export default async function PedidosPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 px-4 py-16 text-center">
        <ClipboardList className="size-10 text-muted-foreground" />
        <p className="font-medium">Entre para ver seus pedidos</p>
        <Button asChild className="w-full">
          <Link href="/login?redirect=/pedidos">
            <LogIn /> Entrar
          </Link>
        </Button>
      </div>
    );
  }

  const orders = await getMyOrders();

  if (orders.length === 0) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-4 py-16 text-center">
        <ClipboardList className="size-10 text-muted-foreground" />
        <p className="font-medium">Você ainda não fez pedidos</p>
        <Button asChild className="mt-1">
          <Link href="/">Ver produtos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <h1 className="section-title">Meus pedidos</h1>
      <ul className="flex flex-col gap-3">
        {orders.map((o) => (
          <li key={o.id}>
            <Link
              href={`/pedidos/${o.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary/40"
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium">Pedido #{o.order_number}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(o.created_at)}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <OrderStatusBadge status={o.status} />
                <span className="text-sm font-semibold">{formatBRL(o.total)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
