"use client";

import { deleteProduct } from "@/actions/admin/products";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/use-toast";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ProductDelete({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function doDelete() {
    startTransition(async () => {
      const res = await deleteProduct(productId);
      if (!res.ok) {
        toast({ variant: "error", title: "Não foi possível excluir", description: res.error });
        setConfirming(false);
        return;
      }
      toast({ variant: "success", title: "Produto excluído" });
      router.push("/admin/produtos");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-destructive">Excluir produto</p>
          <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">
            Remove <strong>{productName}</strong> definitivamente (fotos, tamanhos e estoque). O
            histórico de pedidos é preservado. Esta ação não pode ser desfeita.
          </p>
        </div>
        {confirming ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="destructive" size="sm" onClick={doDelete} disabled={pending}>
              {pending ? "Excluindo…" : "Sim, excluir"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="size-4" /> Excluir
          </Button>
        )}
      </div>
    </div>
  );
}
