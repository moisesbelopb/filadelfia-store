"use client";

import { setItemPending } from "@/actions/admin/order-items";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/use-toast";
import { formatBRL } from "@/lib/utils";
import type { OrderItem } from "@/types/db";
import { AlertTriangle, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Itens do pedido (admin) com opção de marcar/editar pendência por item. */
export function OrderItemsAdmin({ items, total }: { items: OrderItem[]; total: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState("");

  function open(item: OrderItem) {
    setEditing(item.id);
    setNote(item.pending_note ?? "");
  }

  function save(itemId: string) {
    startTransition(async () => {
      const res = await setItemPending({ itemId, note });
      if (!res.ok) {
        toast({ variant: "error", title: "Não foi possível salvar", description: res.error });
        return;
      }
      toast({ variant: "success", title: note.trim() ? "Pendência salva" : "Pendência removida" });
      setEditing(null);
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((it) => (
        <div key={it.id} className="flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2 text-sm">
            <span>
              {it.quantity}× {it.product_name}
              {it.variant_size ? ` · Tam. ${it.variant_size}` : ""}
            </span>
            <span className="whitespace-nowrap font-medium">{formatBRL(it.line_total)}</span>
          </div>

          {it.pending_note && (
            <div className="flex items-start gap-1.5 rounded-md bg-warning/10 px-2.5 py-1.5 text-xs text-warning-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
              <span>
                <strong>Pendência:</strong> {it.pending_note}
              </span>
            </div>
          )}

          {editing === it.id ? (
            <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-2">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Ex.: Camiseta P em falta — cliente aguardando reposição."
              />
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={pending} onClick={() => save(it.id)}>
                  {pending ? "Salvando..." : "Salvar"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setEditing(null)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => open(it)}
              className="flex w-fit items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              <Pencil className="size-3" />
              {it.pending_note ? "Editar pendência" : "Marcar pendência"}
            </button>
          )}
        </div>
      ))}

      <Separator className="my-1" />
      <div className="flex justify-between font-semibold">
        <span>Total</span>
        <span>{formatBRL(total)}</span>
      </div>
    </div>
  );
}
