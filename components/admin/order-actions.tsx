"use client";

import { changeOrderStatus, editOrderStatus, notifyStatusWhatsapp } from "@/actions/admin/orders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { emailEventForStatus, notificationEventLabel } from "@/lib/email/defaults";
import { REASON_REQUIRED, nextStatuses, statusLabel } from "@/lib/orders/fsm";
import { toast } from "@/lib/use-toast";
import type { FulfillmentType, OrderStatus } from "@/types/db";
import { MessageCircle, SquarePen } from "lucide-react";
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

/** Todos os status, em ordem lógica, para o seletor de edição manual. */
const ALL_STATUSES: OrderStatus[] = [
  "solicitado",
  "aceito",
  "em_separacao",
  "saiu_entrega",
  "entregue",
  "recusado",
  "cancelado",
];

/** Rótulo do botão ciente do modo de recebimento (retirada vs entrega). */
function actionLabel(to: OrderStatus, fulfillment: FulfillmentType): string {
  if (fulfillment === "retirada") {
    if (to === "saiu_entrega") return "Pronto para retirada";
    if (to === "entregue") return "Marcar retirado";
  }
  return ACTION_LABEL[to];
}

/** Evento de notificação de um status (solicitado equivale a "pedido recebido"). */
function eventForStatus(status: OrderStatus, fulfillment: FulfillmentType) {
  return status === "solicitado" ? "order_placed" : emailEventForStatus(status, fulfillment);
}

export function OrderActions({
  orderId,
  status,
  fulfillmentType,
}: {
  orderId: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reasonFor, setReasonFor] = useState<OrderStatus | null>(null);
  const [reason, setReason] = useState("");
  // Status para o qual estamos oferecendo o aviso por WhatsApp (null = fechado).
  const [whatsappFor, setWhatsappFor] = useState<OrderStatus | null>(null);
  // Edição/correção manual do status.
  const [editOpen, setEditOpen] = useState(false);
  const [editTo, setEditTo] = useState<OrderStatus>(status);
  const [editReason, setEditReason] = useState("");

  const next = nextStatuses(status);
  const whatsappEvent = whatsappFor ? eventForStatus(whatsappFor, fulfillmentType) : null;

  function apply(to: OrderStatus, why?: string) {
    startTransition(async () => {
      const res = await changeOrderStatus({ orderId, to, reason: why });
      if (!res.ok) {
        toast({ variant: "error", title: "Não foi possível atualizar", description: res.error });
        return;
      }
      toast({ variant: "success", title: `Pedido: ${actionLabel(to, fulfillmentType)}` });
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

  function openEdit() {
    setEditTo(status);
    setEditReason("");
    setEditOpen(true);
  }

  function applyEdit() {
    startTransition(async () => {
      const needsReason = REASON_REQUIRED.includes(editTo);
      const res = await editOrderStatus({
        orderId,
        to: editTo,
        reason: needsReason ? editReason.trim() : undefined,
      });
      if (!res.ok) {
        toast({
          variant: "error",
          title: "Não foi possível editar o status",
          description: res.error,
        });
        return;
      }
      toast({
        variant: "success",
        title: `Status alterado para ${statusLabel(editTo, fulfillmentType)}`,
      });
      setEditOpen(false);
      setEditReason("");
      router.refresh();
      // Oferece avisar o cliente pelo WhatsApp sobre o novo status.
      if (eventForStatus(editTo, fulfillmentType)) setWhatsappFor(editTo);
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
            {actionLabel(to, fulfillmentType)}
          </Button>
        );
      })}

      {/* Aviso de status pelo WhatsApp, disponível a qualquer momento. */}
      <Button variant="outline" disabled={pending} onClick={() => setWhatsappFor(status)}>
        <MessageCircle className="size-4" /> Avisar pelo WhatsApp
      </Button>

      {/* Editar/corrigir o status manualmente (fora da ordem normal). */}
      <Button variant="outline" disabled={pending} onClick={openEdit}>
        <SquarePen className="size-4" /> Editar status
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

      {/* Edição/correção manual do status (força fora da ordem normal). */}
      <Dialog open={editOpen} onOpenChange={(o) => !o && setEditOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar status do pedido</DialogTitle>
            <DialogDescription>
              Define o status manualmente, fora da ordem normal — use para corrigir. Reabrir um
              pedido cancelado/recusado só funciona se houver estoque. O cliente recebe o e-mail do
              novo status.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-status">Novo status</Label>
              <Select
                id="edit-status"
                value={editTo}
                onChange={(e) => setEditTo(e.target.value as OrderStatus)}
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s, fulfillmentType)}
                    {s === status ? " (atual)" : ""}
                  </option>
                ))}
              </Select>
            </div>
            {REASON_REQUIRED.includes(editTo) && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-reason">Motivo (exibido ao cliente)</Label>
                <Textarea
                  id="edit-reason"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Motivo"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Voltar
            </Button>
            <Button
              disabled={
                pending ||
                editTo === status ||
                (REASON_REQUIRED.includes(editTo) && !editReason.trim())
              }
              onClick={applyEdit}
            >
              Salvar status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
