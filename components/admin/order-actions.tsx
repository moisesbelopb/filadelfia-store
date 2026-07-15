"use client";

import { changeOrderStatus, markOrderPaid, notifyStatusWhatsapp } from "@/actions/admin/orders";
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
import { emailEventForStatus, notificationEventLabel } from "@/lib/email/defaults";
import { REASON_REQUIRED, nextStatuses } from "@/lib/orders/fsm";
import { toast } from "@/lib/use-toast";
import type { FulfillmentType, OrderStatus, PaymentStatus } from "@/types/db";
import { MessageCircle } from "lucide-react";
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

/** Evento de notificação de um status (solicitado equivale a "pedido recebido"). */
function eventForStatus(status: OrderStatus, fulfillment: FulfillmentType) {
  return status === "solicitado" ? "order_placed" : emailEventForStatus(status, fulfillment);
}

export function OrderActions({
  orderId,
  status,
  paymentStatus,
  fulfillmentType,
}: {
  orderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentType: FulfillmentType;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reasonFor, setReasonFor] = useState<OrderStatus | null>(null);
  const [reason, setReason] = useState("");
  // Status para o qual estamos oferecendo o aviso por WhatsApp (null = fechado).
  const [whatsappFor, setWhatsappFor] = useState<OrderStatus | null>(null);

  const next = nextStatuses(status);
  const whatsappEvent = whatsappFor ? eventForStatus(whatsappFor, fulfillmentType) : null;

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
      // Oferece avisar o cliente pelo WhatsApp sobre o novo status.
      if (eventForStatus(to, fulfillmentType)) setWhatsappFor(to);
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

  function sendWhatsapp() {
    // Abre a aba JÁ no clique (gesto do usuário) para o navegador não bloquear;
    // depois só apontamos a aba para o link que o servidor montou.
    const win = window.open("", "_blank");
    startTransition(async () => {
      const res = await notifyStatusWhatsapp(orderId);
      if (!res.ok) {
        win?.close();
        toast({
          variant: "error",
          title: "Não foi possível preparar o WhatsApp",
          description: res.error,
        });
        return;
      }
      if (win) win.location.href = res.data.waUrl;
      else window.location.href = res.data.waUrl;
      toast({
        variant: "success",
        title: "WhatsApp aberto",
        description: "Confira a mensagem e toque em enviar.",
      });
      setWhatsappFor(null);
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

      {/* Aviso de status pelo WhatsApp, disponível a qualquer momento. */}
      <Button variant="outline" disabled={pending} onClick={() => setWhatsappFor(status)}>
        <MessageCircle className="size-4" /> Avisar pelo WhatsApp
      </Button>

      {/* Motivo (recusa/cancelamento) */}
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

      {/* Aviso por WhatsApp (manual) */}
      <Dialog open={whatsappFor !== null} onOpenChange={(o) => !o && setWhatsappFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avisar o cliente pelo WhatsApp?</DialogTitle>
            <DialogDescription>
              Vamos abrir o WhatsApp com a mensagem de{" "}
              <strong>“{notificationEventLabel(whatsappEvent)}”</strong> já escrita. Confira e toque
              em enviar — o aviso fica registrado como enviado pelo WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWhatsappFor(null)}>
              Agora não
            </Button>
            <Button variant="success" disabled={pending} onClick={sendWhatsapp}>
              <MessageCircle className="size-4" /> Abrir WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
