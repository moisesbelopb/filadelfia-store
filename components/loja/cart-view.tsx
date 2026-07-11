"use client";

import { ProductThumb } from "@/components/loja/product-thumb";
import { QuantityStepper } from "@/components/loja/quantity-stepper";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/utils";
import { cartSubtotal, useCart } from "@/stores/cart";
import { ShoppingCart, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function CartView() {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ShoppingCart className="size-10 text-muted-foreground" />
        <p className="font-medium">Seu carrinho está vazio</p>
        <p className="text-sm text-muted-foreground">Adicione produtos para continuar.</p>
        <Button asChild className="mt-2">
          <Link href="/">Ver produtos</Link>
        </Button>
      </div>
    );
  }

  const subtotal = cartSubtotal(items);

  return (
    <div className="flex flex-col gap-4 pb-28">
      <h1 className="text-xl font-semibold">Seu carrinho</h1>

      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {items.map((item) => (
          <li key={item.variantId} className="flex gap-4 py-4">
            <Link
              href={`/produtos/${item.slug}`}
              className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-md border border-border bg-secondary"
            >
              <ProductThumb name={item.name} path={item.image} sizes="80px" />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/produtos/${item.slug}`}
                    className="line-clamp-2 text-sm font-medium"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-0.5 text-xs uppercase tracking-[0.1em] text-muted-foreground">
                    {item.colorName ? `${item.colorName} · ` : ""}Tam. {item.size}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(item.variantId)}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                  aria-label={`Remover ${item.name} tamanho ${item.size}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <QuantityStepper
                  value={item.quantity}
                  onChange={(q) => setQty(item.variantId, q)}
                  max={Math.max(1, item.stock)}
                />
                <span className="font-semibold">{formatBRL(item.price * item.quantity)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-4 backdrop-blur sm:bottom-0"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Subtotal</span>
            <span className="text-lg font-bold">{formatBRL(subtotal)}</span>
          </div>
          <Button asChild size="lg" className="flex-1">
            <Link href="/checkout">Finalizar pedido</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
