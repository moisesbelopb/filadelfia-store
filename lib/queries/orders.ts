import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Order, OrderItem, OrderWithItems } from "@/types/db";

/** Item do pedido com a foto do produto (para a miniatura do card). */
export interface MyOrderItem extends OrderItem {
  image: string | null;
}

/** Pedido do cliente pronto para o card da listagem. */
export interface MyOrder extends Order {
  order_items: MyOrderItem[];
}

/**
 * Pedidos do cliente atual (RLS filtra automaticamente), já com os itens e a
 * foto principal de cada produto — a listagem mostra miniaturas, como fazem os
 * grandes e-commerces.
 */
export async function getMyOrders(): Promise<MyOrder[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });

  const orders = (data as (Order & { order_items: OrderItem[] })[] | null) ?? [];
  if (orders.length === 0) return [];

  // Foto principal de cada produto (produto excluído fica sem imagem).
  const productIds = [
    ...new Set(
      orders.flatMap((o) => (o.order_items ?? []).map((i) => i.product_id)).filter(Boolean),
    ),
  ] as string[];

  const imageByProduct = new Map<string, string>();
  if (productIds.length > 0) {
    const { data: images } = await supabase
      .from("product_images")
      .select("product_id, storage_path, is_primary, position")
      .in("product_id", productIds)
      .order("position", { ascending: true });

    for (const img of (images ?? []) as {
      product_id: string;
      storage_path: string;
      is_primary: boolean;
    }[]) {
      // A principal vence; senão fica a primeira por posição.
      if (img.is_primary || !imageByProduct.has(img.product_id)) {
        imageByProduct.set(img.product_id, img.storage_path);
      }
    }
  }

  return orders.map((o) => ({
    ...o,
    order_items: (o.order_items ?? []).map((i) => ({
      ...i,
      image: i.product_id ? (imageByProduct.get(i.product_id) ?? null) : null,
    })),
  }));
}

/** Um pedido do cliente com itens e histórico (RLS garante posse). */
export async function getMyOrder(id: string): Promise<OrderWithItems | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*), order_status_history(*)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const order = data as OrderWithItems;
  order.order_status_history?.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  return order;
}
