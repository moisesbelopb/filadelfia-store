"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartLine {
  /** Chave única da linha = produto + tamanho (variante). */
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  /** Tamanho escolhido (PP, M, 4...). */
  size: string;
  price: number;
  quantity: number;
  image?: string | null;
  /** Estoque desta variante (tamanho). */
  stock: number;
  colorName?: string | null;
}

interface CartState {
  items: CartLine[];
  add: (line: Omit<CartLine, "quantity">, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
}

/**
 * Carrinho no client (persistido em localStorage). Funciona para visitantes;
 * no checkout é sincronizado ao servidor antes de criar o pedido.
 * Cada linha é uma variante (produto + tamanho).
 */
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (line, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.variantId === line.variantId);
          if (existing) {
            const nextQty = Math.min(existing.quantity + qty, line.stock);
            return {
              items: s.items.map((i) =>
                i.variantId === line.variantId ? { ...i, quantity: nextQty } : i,
              ),
            };
          }
          return { items: [...s.items, { ...line, quantity: Math.min(qty, line.stock) }] };
        }),
      setQty: (variantId, qty) =>
        set((s) => ({
          items: s.items
            .map((i) =>
              i.variantId === variantId
                ? { ...i, quantity: Math.max(1, Math.min(qty, i.stock)) }
                : i,
            )
            .filter((i) => i.quantity > 0),
        })),
      remove: (variantId) =>
        set((s) => ({ items: s.items.filter((i) => i.variantId !== variantId) })),
      clear: () => set({ items: [] }),
    }),
    { name: "filadelfia-cart", version: 2 },
  ),
);

/** Total de itens (soma de quantidades). */
export function cartCount(items: CartLine[]): number {
  return items.reduce((acc, i) => acc + i.quantity, 0);
}

/** Subtotal em BRL. */
export function cartSubtotal(items: CartLine[]): number {
  return items.reduce((acc, i) => acc + i.price * i.quantity, 0);
}
