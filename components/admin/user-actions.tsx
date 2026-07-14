"use client";

import { deleteUser, setUserActive } from "@/actions/admin/users";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/use-toast";
import { Ban, CircleCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Desativar/reativar e excluir uma conta.
 *
 * `entity` define o texto ("cliente" no menu Clientes, "usuário" no de admins).
 * `ordersCount` faz a confirmação avisar que o histórico de pedidos será
 * apagado junto — a exclusão é permitida mesmo com pedidos.
 */
export function UserActions({
  userId,
  active,
  entity = "usuário",
  ordersCount = 0,
}: {
  userId: string;
  active: boolean;
  entity?: "usuário" | "cliente";
  ordersCount?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const Entity = entity.charAt(0).toUpperCase() + entity.slice(1);
  const hasOrders = ordersCount > 0;

  function toggleActive() {
    startTransition(async () => {
      const res = await setUserActive({ userId, active: !active });
      if (!res.ok) {
        toast({ variant: "error", title: "Erro", description: res.error });
        return;
      }
      toast({
        variant: "success",
        title: active ? `${Entity} desativado` : `${Entity} reativado`,
      });
      router.refresh();
    });
  }

  function doDelete() {
    startTransition(async () => {
      const res = await deleteUser({ userId });
      if (!res.ok) {
        toast({ variant: "error", title: "Não foi possível excluir", description: res.error });
        setConfirming(false);
        return;
      }
      toast({
        variant: "success",
        title: `${Entity} excluído`,
        description: hasOrders
          ? `O cadastro e ${ordersCount} ${ordersCount === 1 ? "pedido" : "pedidos"} do histórico foram apagados.`
          : undefined,
      });
      setConfirming(false);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
        <p className="max-w-xs text-xs text-destructive sm:text-right">
          {hasOrders ? (
            <>
              Excluir este {entity} também vai apagar{" "}
              <strong>
                {ordersCount} {ordersCount === 1 ? "pedido" : "pedidos"}
              </strong>{" "}
              do histórico. Deseja continuar?
            </>
          ) : (
            <>Excluir este {entity} definitivamente? Esta ação não pode ser desfeita.</>
          )}
        </p>
        <div className="flex items-center gap-1.5">
          <Button variant="destructive" size="sm" onClick={doDelete} disabled={pending}>
            {pending ? "Excluindo…" : hasOrders ? "Sim, excluir tudo" : "Sim, excluir"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleActive}
        disabled={pending}
        title={active ? "Desativar (bloqueia o acesso)" : "Reativar"}
      >
        {active ? <Ban className="size-4" /> : <CircleCheck className="size-4 text-success" />}
        <span className="hidden sm:inline">{active ? "Desativar" : "Reativar"}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(true)}
        disabled={pending}
        className="text-destructive hover:text-destructive"
        title="Excluir definitivamente"
      >
        <Trash2 className="size-4" />
        <span className="hidden sm:inline">Excluir</span>
      </Button>
    </div>
  );
}
