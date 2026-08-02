"use client";

import { loadCart, syncCart } from "@/actions/cart";
import { createClient } from "@/lib/supabase/client";
import { type CartLine, useCart } from "@/stores/cart";
import { useEffect, useRef } from "react";

const toInput = (i: CartLine) => ({
  productId: i.productId,
  variantId: i.variantId,
  quantity: i.quantity,
});

/**
 * Sincroniza o carrinho do cliente LOGADO com o servidor (habilita o lembrete
 * de abandono + carrinho entre dispositivos). Não renderiza nada. Visitante não
 * logado: as actions são no-op, então nada acontece.
 */
export function CartSync() {
  const items = useCart((s) => s.items);
  const hydrated = useRef(false);
  const skipNextSync = useRef(true);

  // Hidrata do servidor no login (uma vez). Carrinho local vazio → puxa o do
  // servidor; local com itens → o local vence e sobe pro servidor.
  useEffect(() => {
    const supabase = createClient();
    async function hydrate() {
      if (hydrated.current) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      hydrated.current = true;
      const local = useCart.getState().items;
      if (local.length === 0) {
        const server = await loadCart();
        if (server.length) {
          skipNextSync.current = true;
          useCart.getState().replace(server);
        }
      } else {
        await syncCart(local.map(toInput));
      }
    }
    hydrate();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") hydrate();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Sincroniza mudanças do carrinho (debounce). syncCart não faz nada se não
  // estiver logado. Pula o primeiro disparo (mount) e o pós-hidratação.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void syncCart(items.map(toInput));
    }, 3000);
    return () => clearTimeout(timer.current);
  }, [items]);

  return null;
}
