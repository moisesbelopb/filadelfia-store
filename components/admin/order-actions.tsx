"use client";

import { changeOrderStatus, markOrderPaid } from "@/actions/admin/orders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { REASON_REQUIRED, nextStatuses } from "@/lib/orders/fsm";
import { toast } from "@/lib/use-toast";
import type { OrderStatus, PaymentStatus } from "@/types/db";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const ACTION_LABEL: Record<OrderStatus, string> = {
  solicitado: "Solicitado",
  aceito: "Aceitar",
  em_separacao: "Iniciar separação",
  saiu_entrega: "Saiu para entrega",
  entregue: "Marcar entregue",
  recusado: "Recusar",
  cancelado: "Cancelar",
};

export function OrderActions({
  orderId,
  status,
  paymentStatus,
}: {
  orderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reasonFor, setReasonFor] = useState<OrderStatus | null>(null);
  const [reason, setReason] = useState("");

  const next = nextStatuses(status);

  function apply(to: OrderStatus, why?: string) {
    startTransition(async () => {
      const res = await changeOrderStatus({ orderId, to, reason: why });
      if (!res.ok) {
        toast({ variant: "error", title: "Não foi possível atualizar", description: res.error });
        return;
      }
      toast({ variant: "success", title: `Pedido: ${ACTION_LABEL[to]}` });
      setReasonFor(null);
      setReason("");
      router.refresh();
    });
  }

  function onClick(to: OrderStatus) {
    if (REASON_REQUIRED.includes(to)) {
      setReasonFor(to);
      return;
    }
    apply(to);
  }

  function paid() {
    startTransition(async () => {
      const res = await markOrderPaid(orderId);
      if (!res.ok) {
        toast({ variant: "error", title: "Erro", description: res.error });
        return;
      }
      toast({ variant: "success", title: "Pagamento confirmado" });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {next.map((to) => {
        const negative = REASON_REQUIRED.includes(to);
        return (
          <Button
            key={to}
            variant={negative ? "outline" : "default"}
            className={negative ? "text-destructive" : undefined}
            disabled={pending}
            onClick={() => onClick(to)}
          >
            {ACTION_LABEL[to]}
          </Button>
        );
      })}

      {paymentStatus === "pendente" &&
        status !== "solicitado" &&
        !["recusado", "cancelado"].includes(status) && (
          <Button variant="success" disabled={pending} onClick={paid}>
            Marcar como pago
          </Button>
        )}

      <Dialog open={reasonFor !== null} onOpenChange={(o) => !o && setReasonFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reasonFor === "recusado" ? "Recusar pedido" : "Cancelar pedido"}
            </DialogTitle>
            <DialogDescription>Informe o motivo (será exibido ao cliente).</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReasonFor(null)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={pending || !reason.trim()}
              onClick={() => reasonFor && apply(reasonFor, reason.trim())}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
