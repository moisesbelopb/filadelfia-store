"use client";

import { ProductThumb } from "@/components/loja/product-thumb";
import { QuantityStepper } from "@/components/loja/quantity-stepper";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/use-toast";
import { cn, formatBRL } from "@/lib/utils";
import { useCart } from "@/stores/cart";
import type { ProductWithImages } from "@/types/db";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/** Nível de ampliação da lupa (ao clicar, no desktop). */
const ZOOM = 2;
const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** Ícone de carrinho com "+" dentro (estilo lucide). */
function CartPlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
      <path d="M2 3h1.6a1 1 0 0 1 .98.8l2.2 11a1.6 1.6 0 0 0 1.57 1.28h8.9a1.6 1.6 0 0 0 1.56-1.25L21 8H6" />
      <path d="M12.5 6v4.5" />
      <path d="M10.25 8.25h4.5" />
    </svg>
  );
}

/**
 * Botão de sacola no card + modal de compra rápida:
 * escolhe o tamanho (estoque por variante) e adiciona à sacola sem sair da lista.
 */
export function ProductQuickAdd({ product }: { product: ProductWithImages }) {
  const add = useCart((s) => s.add);
  const [open, setOpen] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    setCanHover(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!zoomed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setOrigin({
      x: clamp(((e.clientX - rect.left) / rect.width) * 100),
      y: clamp(((e.clientY - rect.top) / rect.height) * 100),
    });
  }

  function handleZoomClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!canHover) return;
    if (!zoomed) {
      const rect = e.currentTarget.getBoundingClientRect();
      setOrigin({
        x: clamp(((e.clientX - rect.left) / rect.width) * 100),
        y: clamp(((e.clientY - rect.top) / rect.height) * 100),
      });
    }
    setZoomed((z) => !z);
  }

  const images = useMemo(
    () =>
      [...product.product_images].sort((a, b) => {
        if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
        return a.position - b.position;
      }),
    [product.product_images],
  );
  const main = images[activeImg] ?? images[0];

  const variants = useMemo(
    () => [...product.product_variants].sort((a, b) => a.position - b.position),
    [product.product_variants],
  );
  const selected = variants.find((v) => v.id === selectedId) ?? null;
  const allSoldOut = variants.length > 0 && variants.every((v) => v.stock <= 0);

  function select(v: (typeof variants)[number]) {
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
        productId: product.id,
        slug: product.slug,
        name: product.name,
        size: selected.size,
        price: product.price,
        image: images[0]?.storage_path ?? null,
        stock: selected.stock,
        colorName: product.color_name,
      },
      qty,
    );
    setAdded(true);
    toast({
      variant: "success",
      title: "Adicionado à sacola",
      description: `${product.name} · Tam. ${selected.size}`,
    });
    setTimeout(() => {
      setAdded(false);
      setOpen(false);
    }, 700);
  }

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (!o) {
      setActiveImg(0);
      setSelectedId(null);
      setQty(1);
      setAdded(false);
      setZoomed(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={`Escolher tamanho de ${product.name}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          <CartPlusIcon className="size-[18px]" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 grid max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 grid-rows-[auto_1fr] overflow-hidden rounded-lg border border-border bg-card shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:grid-cols-2 sm:grid-rows-1"
        >
          <Dialog.Close
            aria-label="Fechar"
            className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-background/85 text-foreground backdrop-blur transition-colors hover:bg-secondary"
          >
            <X className="size-4" />
          </Dialog.Close>

          {/* Galeria: miniaturas enfileiradas + imagem grande */}
          <div className="flex gap-2 bg-secondary p-2 sm:p-3">
            {images.length > 1 && (
              <div className="flex flex-col gap-2">
                {images.map((img, i) => (
                  <button
                    key={`${img.id}-${i}`}
                    type="button"
                    onClick={() => {
                      setActiveImg(i);
                      setZoomed(false);
                    }}
                    aria-label={`Ver imagem ${i + 1}`}
                    aria-current={i === activeImg}
                    className={cn(
                      "relative size-12 shrink-0 overflow-hidden rounded border bg-background transition sm:size-14",
                      i === activeImg
                        ? "border-foreground"
                        : "border-transparent opacity-70 hover:opacity-100",
                    )}
                  >
                    <ProductThumb name={product.name} path={img.storage_path} sizes="80px" />
                  </button>
                ))}
              </div>
            )}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: lupa é aprimoramento só de mouse; teclado usa as miniaturas */}
            <div
              className={cn(
                "relative aspect-[4/5] flex-1 select-none overflow-hidden rounded bg-background",
                canHover && (zoomed ? "cursor-zoom-out" : "cursor-zoom-in"),
              )}
              onMouseMove={canHover ? handleMove : undefined}
              onMouseLeave={() => setZoomed(false)}
              onClick={handleZoomClick}
            >
              <div
                className="absolute inset-0 transition-transform duration-200 ease-out motion-reduce:transition-none"
                style={{
                  transform: zoomed ? `scale(${ZOOM})` : "scale(1)",
                  transformOrigin: `${origin.x}% ${origin.y}%`,
                }}
              >
                <ProductThumb
                  name={main?.alt_text ?? product.name}
                  path={main?.storage_path}
                  sizes="(max-width: 640px) 90vw, 720px"
                />
              </div>
            </div>
          </div>

          {/* Detalhes */}
          <div className="flex flex-col gap-4 overflow-y-auto p-5 sm:p-7">
            <div className="flex flex-col gap-1.5 pr-8">
              {product.category && <span className="eyebrow">{product.category.name}</span>}
              <Dialog.Title className="font-display text-lg font-semibold uppercase tracking-[0.02em]">
                {product.name}
              </Dialog.Title>
              <p className="text-xl font-semibold">{formatBRL(product.price)}</p>
              {product.color_name && (
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Cor — {product.color_name}
                </p>
              )}
            </div>

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
                  const isActive = v.id === selectedId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={out}
                      onClick={() => select(v)}
                      aria-pressed={isActive}
                      className={cn(
                        "flex h-11 min-w-[3rem] items-center justify-center rounded-md border px-3 text-sm font-medium uppercase tracking-wide transition-colors",
                        out &&
                          "cursor-not-allowed border-border text-muted-foreground/40 line-through",
                        !out && isActive && "border-foreground bg-foreground text-background",
                        !out && !isActive && "border-border hover:border-foreground",
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
              // No mobile empilha: o rótulo é longo e não quebra linha
              // (whitespace-nowrap), então dividir a linha com o seletor de
              // quantidade cortaria o texto.
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <QuantityStepper
                  value={qty}
                  onChange={setQty}
                  max={Math.max(1, selected?.stock ?? 1)}
                  className="self-start sm:self-auto"
                />
                <Button
                  onClick={handleAdd}
                  size="lg"
                  className="w-full px-4 text-sm uppercase tracking-[0.06em] sm:w-auto sm:min-w-[11rem] sm:flex-1 sm:px-8 sm:text-base sm:tracking-[0.1em]"
                >
                  {added ? <Check /> : <ShoppingBag />}
                  {added ? "Adicionado" : "Adicionar à sacola"}
                </Button>
              </div>
            )}

            <Dialog.Close asChild>
              <Link
                href={`/produtos/${product.slug}`}
                className="text-center text-xs uppercase tracking-[0.12em] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                Ver todos os detalhes
              </Link>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
