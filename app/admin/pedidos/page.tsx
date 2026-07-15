import { OrderStatusBadge } from "@/components/loja/order-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STATUS_LABEL } from "@/lib/orders/fsm";
import { listAdminOrders } from "@/lib/queries/admin";
import { cardHighlight, cn, formatBRL, formatDateTime } from "@/lib/utils";
import type { OrderStatus } from "@/types/db";
import { ClipboardList, Search } from "lucide-react";
import Link from "next/link";

const FILTERS: (OrderStatus | "todos")[] = [
  "todos",
  "solicitado",
  "aceito",
  "em_separacao",
  "saiu_entrega",
  "entregue",
  "recusado",
  "cancelado",
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const active = (status as OrderStatus | undefined) ?? undefined;
  const orders = await listAdminOrders(active, q);

  // Preserva a busca ao trocar de status (e vice-versa).
  const qs = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (active) params.set("status", active);
    if (q) params.set("q", q);
    for (const [k, v] of Object.entries(extra)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const s = params.toString();
    return s ? `/admin/pedidos?${s}` : "/admin/pedidos";
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Pedidos</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/pedidos/separacao">
            <ClipboardList className="size-4" /> Lista de separação
          </Link>
        </Button>
      </div>

      <form className="flex gap-2">
        {active && <input type="hidden" name="status" value={active} />}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por nº, nome ou WhatsApp"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary" className="shrink-0">
          Buscar
        </Button>
      </form>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => {
          const isActive = f === "todos" ? !active : active === f;
          const href = f === "todos" ? qs({ status: undefined }) : qs({ status: f });
          return (
            <Link
              key={f}
              href={href}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-secondary",
              )}
            >
              {f === "todos" ? "Todos" : STATUS_LABEL[f as OrderStatus]}
            </Link>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {q
            ? `Nenhum pedido encontrado para “${q}”.`
            : `Nenhum pedido ${active ? `com status “${STATUS_LABEL[active]}”` : "ainda"}.`}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/admin/pedidos/${o.id}`}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4",
                  cardHighlight,
                )}
              >
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">
                    #{o.order_number} · {o.customer_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(o.created_at)} · {o.customer_whatsapp}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <OrderStatusBadge status={o.status} />
                  <span className="text-sm font-semibold">{formatBRL(o.total)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
