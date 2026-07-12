"use client";

import { deleteUser, setUserActive } from "@/actions/admin/users";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/use-toast";
import { Ban, CircleCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Desativar/reativar e excluir um usuário. `canDelete` some p/ quem tem pedidos? não —
 * a exclusão é tentada e o servidor bloqueia com mensagem clara se houver pedidos. */
export function UserActions({ userId, active }: { userId: string; active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function toggleActive() {
    startTransition(async () => {
      const res = await setUserActive({ userId, active: !active });
      if (!res.ok) {
        toast({ variant: "error", title: "Erro", description: res.error });
        return;
      }
      toast({
        variant: "success",
        title: active ? "Usuário desativado" : "Usuário reativado",
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
      toast({ variant: "success", title: "Usuário excluído" });
      setConfirming(false);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Excluir de vez?</span>
        <Button variant="destructive" size="sm" onClick={doDelete} disabled={pending}>
          {pending ? "Excluindo…" : "Sim, excluir"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
          Cancelar
        </Button>
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
