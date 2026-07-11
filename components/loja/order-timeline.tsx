import { ORDER_STATUS_FLOW, STATUS_CUSTOMER_MSG, STATUS_LABEL } from "@/lib/orders/fsm";
import { cn, formatDateTime } from "@/lib/utils";
import type { OrderStatus, OrderStatusHistory } from "@/types/db";
import { Check, X } from "lucide-react";

export function OrderTimeline({
  status,
  history,
  reason,
}: {
  status: OrderStatus;
  history?: OrderStatusHistory[];
  reason?: string | null;
}) {
  const timeByStatus = new Map<OrderStatus, string>();
  for (const h of history ?? []) timeByStatus.set(h.to_status, h.created_at);

  // Pedido recusado ou cancelado: caminho encerrado.
  if (status === "recusado" || status === "cancelado") {
    return (
      <ol className="flex flex-col">
        <Step
          label={STATUS_LABEL.solicitado}
          description={STATUS_CUSTOMER_MSG.solicitado}
          time={timeByStatus.get("solicitado")}
          state="done"
        />
        <Step
          label={STATUS_LABEL[status]}
          description={reason ? `Motivo: ${reason}` : STATUS_CUSTOMER_MSG[status]}
          time={timeByStatus.get(status)}
          state="failed"
          last
        />
      </ol>
    );
  }

  const currentIndex = ORDER_STATUS_FLOW.indexOf(status);

  return (
    <ol className="flex flex-col">
      {ORDER_STATUS_FLOW.map((s, i) => (
        <Step
          key={s}
          label={STATUS_LABEL[s]}
          description={STATUS_CUSTOMER_MSG[s]}
          time={timeByStatus.get(s)}
          state={i < currentIndex ? "done" : i === currentIndex ? "current" : "pending"}
          last={i === ORDER_STATUS_FLOW.length - 1}
        />
      ))}
    </ol>
  );
}

function Step({
  label,
  description,
  time,
  state,
  last = false,
}: {
  label: string;
  description: string;
  time?: string;
  state: "done" | "current" | "pending" | "failed";
  last?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            state === "done" && "border-success bg-success text-success-foreground",
            state === "current" && "border-primary bg-primary text-primary-foreground",
            state === "failed" && "border-destructive bg-destructive text-destructive-foreground",
            state === "pending" && "border-border bg-background text-muted-foreground",
          )}
        >
          {state === "done" ? (
            <Check className="size-4" />
          ) : state === "failed" ? (
            <X className="size-4" />
          ) : (
            <span className="size-2 rounded-full bg-current" />
          )}
        </span>
        {!last && (
          <span className={cn("w-0.5 flex-1", state === "done" ? "bg-success" : "bg-border")} />
        )}
      </div>
      <div className={cn("pb-6", last && "pb-0")}>
        <p className={cn("text-sm font-medium", state === "pending" && "text-muted-foreground")}>
          {label}
        </p>
        <p className="text-sm text-muted-foreground">{description}</p>
        {time && <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(time)}</p>}
      </div>
    </li>
  );
}
