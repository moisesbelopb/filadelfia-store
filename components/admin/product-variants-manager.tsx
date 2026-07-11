"use client";

import { saveProductVariants } from "@/actions/admin/products";
import { CardIconHeader } from "@/components/admin/card-icon-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/use-toast";
import { cn } from "@/lib/utils";
import type { ProductVariant } from "@/types/db";
import { Plus, Ruler, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

const SIZE_PRESETS = ["PP", "P", "M", "G", "GG", "XGG", "EXGG"];

type Row = { size: string; stock: number };

export function ProductVariantsManager({
  productId,
  variants,
}: {
  productId: string;
  variants: ProductVariant[];
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    [...(variants ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((v) => ({ size: v.size, stock: v.stock })),
  );
  const [custom, setCustom] = useState("");
  const [pending, startTransition] = useTransition();

  function addSize(raw: string) {
    const size = raw.trim().toUpperCase();
    if (!size) return;
    if (rows.some((r) => r.size.toUpperCase() === size)) {
      toast({ variant: "error", title: "Tamanho já adicionado" });
      return;
    }
    setRows((prev) => [...prev, { size, stock: 0 }]);
  }

  function setStock(index: number, stock: number) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, stock: Math.max(0, stock || 0) } : r)),
    );
  }

  function remove(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function save() {
    startTransition(async () => {
      const res = await saveProductVariants(productId, { variants: rows });
      toast(
        res.ok
          ? { variant: "success", title: "Tamanhos salvos" }
          : { variant: "error", title: "Erro", description: res.error },
      );
    });
  }

  const total = rows.reduce((acc, r) => acc + (Number(r.stock) || 0), 0);

  return (
    <Card>
      <CardIconHeader
        icon={Ruler}
        title="Tamanhos e estoque"
        description="Defina os tamanhos disponíveis e o estoque de cada um. O total é a soma dos tamanhos."
      />
      <CardContent className="flex flex-col gap-4">
        {/* Adicionar tamanhos: presets + personalizado. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {SIZE_PRESETS.map((s) => {
            const added = rows.some((r) => r.size.toUpperCase() === s);
            return (
              <button
                key={s}
                type="button"
                disabled={added}
                onClick={() => addSize(s)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  added
                    ? "cursor-not-allowed border-border text-muted-foreground/50"
                    : "border-border hover:border-foreground/30 hover:bg-secondary",
                )}
              >
                <Plus className="size-3" /> {s}
              </button>
            );
          })}
          <div className="flex items-center gap-1">
            <Input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Outro"
              className="h-8 w-24"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSize(custom);
                  setCustom("");
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                addSize(custom);
                setCustom("");
              }}
            >
              Adicionar
            </Button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Nenhum tamanho ainda. Adicione acima — sem tamanho, o produto não pode ser comprado na
            loja.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {rows.map((r, i) => (
              <div key={r.size} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold uppercase tracking-wide">
                    {r.size}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="-m-1 shrink-0 p-1 text-muted-foreground/60 transition-colors hover:text-destructive"
                    aria-label={`Remover tamanho ${r.size}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                    Estoque
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={r.stock}
                    onChange={(e) => setStock(i, Number(e.target.value))}
                    className="h-9 w-full tabular-nums"
                    aria-label={`Estoque do tamanho ${r.size}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-sm text-muted-foreground">
            Estoque total: <strong className="text-foreground">{total}</strong>
          </p>
          <Button onClick={save} disabled={pending}>
            {pending ? "Salvando..." : "Salvar tamanhos"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
