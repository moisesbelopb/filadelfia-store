"use client";

import { changeOrderItem, deleteOrderItem, setItemPending } from "@/actions/admin/order-items";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { PickerProduct } from "@/lib/queries/admin";
import { toast } from "@/lib/use-toast";
import { formatBRL } from "@/lib/utils";
import type { OrderItem } from "@/types/db";
import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Itens do pedido (admin): pendência, alterar quantidade/produto/tamanho e excluir. */
export function OrderItemsAdmin({
  items,
  total,
  products,
}: {
  items: OrderItem[];
  total: number;
  products: PickerProduct[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [pendingItem, setPendingItem] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const [editItem, setEditItem] = useState<OrderItem | null>(null);
  const [editProduct, setEditProduct] = useState("");
  const [editVariant, setEditVariant] = useState("");
  const [editQty, setEditQty] = useState(1);

  const [deleteItem, setDeleteItem] = useState<OrderItem | null>(null);

  const chosenProduct = products.find((p) => p.id === editProduct);

  function openPending(it: OrderItem) {
    setPendingItem(it.id);
    setNote(it.pending_note ?? "");
  }
  function savePending(itemId: string) {
    startTransition(async () => {
      const res = await setItemPending({ itemId, note });
      if (!res.ok) {
        toast({ variant: "error", title: "Não foi possível salvar", description: res.error });
        return;
      }
      toast({ variant: "success", title: note.trim() ? "Pendência salva" : "Pendência removida" });
      setPendingItem(null);
      setNote("");
      router.refresh();
    });
  }

  function openEdit(it: OrderItem) {
    const prod = products.find((p) => p.id === it.product_id) ?? products[0];
    setEditItem(it);
    setEditProduct(prod?.id ?? "");
    const hasVariant = prod?.variants.some((v) => v.id === it.variant_id);
    setEditVariant(hasVariant ? (it.variant_id ?? "") : (prod?.variants[0]?.id ?? ""));
    setEditQty(it.quantity);
  }
  function pickProduct(id: string) {
    setEditProduct(id);
    setEditVariant(products.find((p) => p.id === id)?.variants[0]?.id ?? "");
  }
  function saveEdit() {
    if (!editItem || !editVariant) return;
    startTransition(async () => {
      const res = await changeOrderItem({
        itemId: editItem.id,
        variantId: editVariant,
        quantity: editQty,
      });
      if (!res.ok) {
        toast({ variant: "error", title: "Não foi possível alterar", description: res.error });
        return;
      }
      toast({ variant: "success", title: "Item atualizado" });
      setEditItem(null);
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleteItem) return;
    startTransition(async () => {
      const res = await deleteOrderItem({ itemId: deleteItem.id });
      if (!res.ok) {
        toast({ variant: "error", title: "Não foi possível excluir", description: res.error });
        return;
      }
      toast({ variant: "success", title: "Item removido" });
      setDeleteItem(null);
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

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <button
              type="button"
              onClick={() => openEdit(it)}
              disabled={pending || products.length === 0}
              className="flex items-center gap-1 text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-40"
            >
              <Pencil className="size-3" /> Editar (qtd/troca)
            </button>
            <button
              type="button"
              onClick={() => openPending(it)}
              className="flex items-center gap-1 text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              <AlertTriangle className="size-3" />
              {it.pending_note ? "Editar pendência" : "Marcar pendência"}
            </button>
            <button
              type="button"
              onClick={() => setDeleteItem(it)}
              disabled={pending}
              className="flex items-center gap-1 text-muted-foreground underline underline-offset-2 hover:text-destructive disabled:opacity-40"
            >
              <Trash2 className="size-3" /> Excluir
            </button>
          </div>

          {pendingItem === it.id && (
            <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-2">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Ex.: Camiseta P em falta — cliente aguardando reposição."
              />
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={pending} onClick={() => savePending(it.id)}>
                  {pending ? "Salvando..." : "Salvar"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setPendingItem(null)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}

      <Separator className="my-1" />
      <div className="flex justify-between font-semibold">
        <span>Total</span>
        <span>{formatBRL(total)}</span>
      </div>

      {/* Editar item (quantidade / trocar produto ou tamanho) */}
      <Dialog open={editItem !== null} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar item</DialogTitle>
            <DialogDescription>
              Troque o produto ou o tamanho e ajuste a quantidade. O estoque e o total do pedido são
              atualizados automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ei-prod">Produto</Label>
              <Select
                id="ei-prod"
                value={editProduct}
                onChange={(e) => pickProduct(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatBRL(p.price)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ei-size">Tamanho</Label>
              <Select
                id="ei-size"
                value={editVariant}
                onChange={(e) => setEditVariant(e.target.value)}
              >
                {(chosenProduct?.variants ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.size} · {v.stock} em estoque
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ei-qty">Quantidade</Label>
              <Input
                id="ei-qty"
                type="number"
                min={1}
                max={99}
                value={editQty}
                onChange={(e) => setEditQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                className="w-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditItem(null)}>
              Voltar
            </Button>
            <Button disabled={pending || !editVariant} onClick={saveEdit}>
              {pending ? "Salvando..." : "Salvar item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir item */}
      <Dialog open={deleteItem !== null} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir item?</DialogTitle>
            <DialogDescription>
              {deleteItem
                ? `"${deleteItem.product_name}"${deleteItem.variant_size ? ` (tam. ${deleteItem.variant_size})` : ""} será removido do pedido. `
                : ""}
              O estoque volta e o total é recalculado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteItem(null)}>
              Voltar
            </Button>
            <Button variant="destructive" disabled={pending} onClick={confirmDelete}>
              {pending ? "Excluindo..." : "Excluir item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
