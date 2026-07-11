import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Order, OrderWithItems } from "@/types/db";

/** Pedidos do cliente atual (RLS filtra automaticamente). */
export async function getMyOrders(): Promise<Order[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as Order[] | null) ?? [];
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
