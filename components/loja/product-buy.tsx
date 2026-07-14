"use client";

import { QuantityStepper } from "@/components/loja/quantity-stepper";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/use-toast";
import { cn } from "@/lib/utils";
import { useCart } from "@/stores/cart";
import { Check, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";

export interface BuyVariant {
  id: string;
  size: string;
  stock: number;
}

interface ProductBuyProps {
  product: {
    productId: string;
    slug: string;
    name: string;
    price: number;
    image: string | null;
    colorName: string | null;
  };
  variants: BuyVariant[];
}

/** Bloco de compra: seleção de tamanho (estoque por variante) + quantidade + adicionar. */
export function ProductBuy({ product, variants }: ProductBuyProps) {
  const add = useCart((s) => s.add);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const selected = useMemo(
    () => variants.find((v) => v.id === selectedId) ?? null,
    [variants, selectedId],
  );
  const allSoldOut = variants.length > 0 && variants.every((v) => v.stock <= 0);

  function select(v: BuyVariant) {
    if (v.stock <= 0) return;
    setSelectedId(v.id);
    setQty(1);
  }

  function handleAdd() {
    if (!selected) {
      toast({ variant: "error", title: "Escolha um tamanho" });
      return;
    }
    add(
      {
        variantId: selected.id,
        productId: product.productId,
        slug: product.slug,
        name: product.name,
        size: selected.size,
        price: product.price,
        image: product.image,
        stock: selected.stock,
        colorName: product.colorName,
      },
      qty,
    );
    setAdded(true);
    toast({
      variant: "success",
      title: "Adicionado à sacola",
      description: `${product.name} · Tam. ${selected.size}`,
    });
    setTimeout(() => setAdded(false), 1400);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Tamanho</span>
          {selected ? (
            <span className="text-xs text-muted-foreground">{selected.stock} em estoque</span>
          ) : (
            !allSoldOut && <span className="text-xs text-muted-foreground">Selecione</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => {
            const out = v.stock <= 0;
            const active = v.id === selectedId;
            return (
              <button
                key={v.id}
                type="button"
                disabled={out}
                onClick={() => select(v)}
                aria-pressed={active}
                className={cn(
                  "flex h-11 min-w-[3rem] items-center justify-center rounded-md border px-3 text-sm font-medium uppercase tracking-wide transition-colors",
                  out && "cursor-not-allowed border-border text-muted-foreground/40 line-through",
                  !out && active && "border-foreground bg-foreground text-background",
                  !out && !active && "border-border hover:border-foreground",
                )}
              >
                {v.size}
              </button>
            );
          })}
        </div>
      </div>

      {allSoldOut ? (
        <Button disabled variant="secondary" size="lg">
          Esgotado
        </Button>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <QuantityStepper
            value={qty}
            onChange={setQty}
            max={Math.max(1, selected?.stock ?? 1)}
            className="self-start sm:self-auto"
          />
          <Button
            onClick={handleAdd}
            size="lg"
            className="w-full px-4 text-sm uppercase tracking-[0.06em] sm:w-auto sm:flex-1 sm:px-8 sm:text-base sm:tracking-[0.12em]"
            aria-label={`Adicionar ${product.name} à sacola`}
          >
            {added ? <Check /> : <ShoppingBag />}
            {added ? "Adicionado" : "Adicionar à sacola"}
          </Button>
        </div>
      )}
    </div>
  );
}
