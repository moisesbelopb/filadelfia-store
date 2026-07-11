import { PrintButton } from "@/components/admin/print-button";
import { STATUS_LABEL } from "@/lib/orders/fsm";
import { listPackingOrders } from "@/lib/queries/admin";
import { formatDateTime } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default async function SeparacaoPage() {
  const orders = await listPackingOrders();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <Link
            href="/admin/pedidos"
            className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" /> Pedidos
          </Link>
          <h1 className="text-xl font-semibold">Lista de separação</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos <strong>aceitos</strong> e <strong>em separação</strong>, do mais antigo para o
            mais novo.
          </p>
        </div>
        <PrintButton />
      </div>

      <h1 className="hidden text-lg font-semibold print:block">
        Lista de separação · {orders.length} pedido(s)
      </h1>

      {orders.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhum pedido para separar no momento.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="rounded-xl border border-border p-4 print:break-inside-avoid print:rounded-none"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-semibold">
                  #{o.order_number} · {o.customer_name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {STATUS_LABEL[o.status]} · {formatDateTime(o.created_at)}
                </span>
              </div>

              <p className="mt-0.5 text-xs text-muted-foreground">
                {o.customer_whatsapp} ·{" "}
                {o.fulfillment_type === "retirada" ? "Retirada na igreja" : "Entrega"}
                {o.scheduled_date ? ` · ${o.scheduled_date}` : ""}
                {o.scheduled_window ? ` (${o.scheduled_window})` : ""}
              </p>

              {o.fulfillment_type === "entrega" && o.address && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {o.address.street}, {o.address.number}
                  {o.address.complement ? ` — ${o.address.complement}` : ""} ·{" "}
                  {o.address.neighborhood}, {o.address.city}
                </p>
              )}

              <ul className="mt-2 flex flex-col gap-1.5">
                {o.order_items.map((it) => (
                  <li key={it.id} className="flex items-center gap-2 text-sm">
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded border border-border text-xs font-semibold tabular-nums">
                      {it.quantity}
                    </span>
                    <span>
                      {it.product_name}
                      {it.variant_size ? (
                        <strong className="ml-1">· Tam. {it.variant_size}</strong>
                      ) : (
                        ""
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              {o.notes && (
                <p className="mt-2 rounded-md bg-secondary/60 px-2 py-1 text-xs">Obs.: {o.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
