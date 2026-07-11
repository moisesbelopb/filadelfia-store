"use client";

import { saveProductVariants } from "@/actions/admin/products";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/use-toast";
import type { ProductVariant } from "@/types/db";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Row = { size: string; stock: number };

const toRows = (variants: ProductVariant[]): Row[] =>
  [...variants]
    .sort((a, b) => a.position - b.position)
    .map((v) => ({ size: v.size, stock: v.stock }));

export function StockAdjuster({
  productId,
  productName,
  variants,
}: {
  productId: string;
  productName: string;
  variants: ProductVariant[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => toRows(variants));
  const [pending, startTransition] = useTransition();

  // Recarrega os valores atuais ao abrir (caso o estoque tenha mudado).
  function onOpenChange(o: boolean) {
    if (o) setRows(toRows(variants));
    setOpen(o);
  }

  function setStock(i: number, val: string) {
    const n = Math.max(0, Math.floor(Number(val) || 0));
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, stock: n } : r)));
  }

  function submit() {
    startTransition(async () => {
      const res = await saveProductVariants(productId, { variants: rows });
      if (!res.ok) {
        toast({ variant: "error", title: "Erro", description: res.error });
        return;
      }
      toast({ variant: "success", title: "Estoque atualizado" });
      setOpen(false);
      router.refresh();
    });
  }

  const total = rows.reduce((s, r) => s + r.stock, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Ajustar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar estoque · {productName}</DialogTitle>
        </DialogHeader>

        {rows.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Este produto ainda não tem tamanhos cadastrados. Adicione os tamanhos na página do
            produto.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Ajuste o estoque de cada tamanho — o total é a soma deles.
            </p>
            {rows.map((r, i) => (
              <div key={r.size} className="flex items-center justify-between gap-3">
                <Label className="w-16 shrink-0 font-medium">{r.size}</Label>
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={String(r.stock)}
                  onChange={(e) => setStock(i, e.target.value)}
                  className="w-28"
                />
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold tabular-nums">{total} un.</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending || rows.length === 0}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
