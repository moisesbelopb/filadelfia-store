import "server-only";

import { isAdminUser } from "@/lib/auth";
import { demoCategories, demoProducts } from "@/lib/demo-data";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type {
  Address,
  Category,
  MessageTemplate,
  NotificationLog,
  Order,
  OrderItem,
  OrderStatus,
  OrderWithItems,
  ProductWithImages,
  UserRole,
} from "@/types/db";

export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  active: boolean;
  created_at: string;
  /** Nº de pedidos — a confirmação de exclusão avisa que o histórico vai junto. */
  ordersCount: number;
}

/** Cliente com todos os dados de cadastro + resumo do histórico de compras. */
export interface CustomerRow extends AdminUserRow {
  whatsapp: string | null;
  address: Address | null;
  totalSpent: number;
  lastOrderAt: string | null;
}

/** Linha base (auth + profile), antes de somar o histórico de pedidos. */
interface BaseUser {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  active: boolean;
  created_at: string;
  whatsapp: string | null;
  address: Address | null;
}

const roleRank: Record<UserRole, number> = { super_admin: 2, admin: 1, cliente: 0 };

/** Base: usuários do auth + dados completos do profile. Só para admin (service role). */
async function fetchUsersWithProfiles(): Promise<BaseUser[]> {
  if (!isSupabaseConfigured) return [];
  if (!(await isAdminUser())) return [];

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }

  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const users = list?.users ?? [];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, role, whatsapp, default_address");
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return users.map((u) => {
    const p = byId.get(u.id);
    // Usuário "banido" (ban_duration) => desativado. banned_until vem do auth.
    const bannedUntil = (u as { banned_until?: string | null }).banned_until;
    const active = !bannedUntil || new Date(bannedUntil).getTime() <= Date.now();
    return {
      id: u.id,
      email: u.email ?? "—",
      full_name: (p?.full_name as string | null) ?? null,
      role: ((p?.role as UserRole) ?? "cliente") satisfies UserRole,
      active,
      created_at: u.created_at,
      whatsapp: (p?.whatsapp as string | null) ?? null,
      address: (p?.default_address as Address | null) ?? null,
    };
  });
}

interface OrderStat {
  count: number;
  total: number;
  last: string | null;
  /** Endereço do pedido de ENTREGA mais recente (fallback do cadastro). */
  lastAddress: Address | null;
  lastAddressAt: string | null;
}

/** Resumo de pedidos por usuário (agregação em memória — volume pequeno). */
async function fetchOrderStats(): Promise<Map<string, OrderStat>> {
  const stats = new Map<string, OrderStat>();
  if (!isSupabaseConfigured) return stats;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return stats;
  }

  const { data: orders } = await admin
    .from("orders")
    .select("user_id, total, status, created_at, address");

  for (const o of (orders ?? []) as {
    user_id: string;
    total: number;
    status: OrderStatus;
    created_at: string;
    address: Address | null;
  }[]) {
    const s: OrderStat = stats.get(o.user_id) ?? {
      count: 0,
      total: 0,
      last: null,
      lastAddress: null,
      lastAddressAt: null,
    };
    s.count += 1;
    // Cancelado/recusado não conta como valor comprado.
    if (o.status !== "cancelado" && o.status !== "recusado") s.total += Number(o.total);
    if (!s.last || new Date(o.created_at) > new Date(s.last)) s.last = o.created_at;
    // Retirada não tem endereço; guarda o da entrega mais recente.
    if (o.address && (!s.lastAddressAt || new Date(o.created_at) > new Date(s.lastAddressAt))) {
      s.lastAddress = o.address;
      s.lastAddressAt = o.created_at;
    }
    stats.set(o.user_id, s);
  }
  return stats;
}

/** Apenas ADMINISTRADORES (admin / super_admin) — para o menu "Usuários". */
export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const [all, stats] = await Promise.all([fetchUsersWithProfiles(), fetchOrderStats()]);
  return all
    .filter((u) => u.role === "admin" || u.role === "super_admin")
    .map((u) => ({ ...u, ordersCount: stats.get(u.id)?.count ?? 0 }))
    .sort((a, b) => roleRank[b.role] - roleRank[a.role]);
}

/**
 * Apenas CLIENTES (role = 'cliente') — para o menu "Clientes".
 * Traz o cadastro completo (nome, e-mail, WhatsApp, endereço) e o resumo de
 * compras (nº de pedidos, total gasto, último pedido). Mais recentes primeiro.
 */
export async function listCustomers(): Promise<CustomerRow[]> {
  const [all, stats] = await Promise.all([fetchUsersWithProfiles(), fetchOrderStats()]);
  return all
    .filter((u) => u.role === "cliente")
    .map((c) => {
      const s = stats.get(c.id);
      return {
        ...c,
        // Perfil primeiro; se vazio, cai no endereço do último pedido de entrega.
        address: c.address ?? s?.lastAddress ?? null,
        ordersCount: s?.count ?? 0,
        totalSpent: s?.total ?? 0,
        lastOrderAt: s?.last ?? null,
      };
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function listAdminOrders(status?: OrderStatus, q?: string): Promise<Order[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  let query = supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data } = await query;
  let rows = (data as Order[] | null) ?? [];

  // Busca por nº do pedido, nome ou WhatsApp — filtrada em memória (segura,
  // volume pequeno) para não montar filtros PostgREST com entrada do usuário.
  const term = q?.trim().toLowerCase();
  if (term) {
    rows = rows.filter(
      (o) =>
        o.customer_name.toLowerCase().includes(term) ||
        (o.customer_whatsapp ?? "").toLowerCase().includes(term) ||
        String(o.order_number).includes(term),
    );
  }
  return rows;
}

export type PackingOrder = Order & { order_items: OrderItem[] };

/** Pedidos a separar (aceito / em separação), com itens e tamanhos, do mais antigo. */
export async function listPackingOrders(): Promise<PackingOrder[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .in("status", ["aceito", "em_separacao"])
    .order("created_at", { ascending: true });
  return (data as PackingOrder[] | null) ?? [];
}

export async function getAdminOrder(id: string): Promise<{
  order: OrderWithItems | null;
  logs: NotificationLog[];
}> {
  if (!isSupabaseConfigured) return { order: null, logs: [] };
  const supabase = await createClient();
  const [{ data: order }, { data: logs }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, order_items(*), order_status_history(*)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("notification_logs")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
  ]);
  const o = order as OrderWithItems | null;
  o?.order_status_history?.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  return { order: o, logs: (logs as NotificationLog[] | null) ?? [] };
}

export async function listAdminProducts(): Promise<ProductWithImages[]> {
  // Modo demonstração: espelha o catálogo da loja (produtos, fotos e estoque).
  if (!isSupabaseConfigured) return demoProducts;
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, product_images(*), product_variants(*), category:categories(id,name,slug)")
    .order("created_at", { ascending: false });
  return (data as ProductWithImages[] | null) ?? [];
}

export async function getAdminProduct(id: string): Promise<ProductWithImages | null> {
  if (!isSupabaseConfigured) return demoProducts.find((p) => p.id === id) ?? null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, product_images(*), product_variants(*), category:categories(id,name,slug)")
    .eq("id", id)
    .maybeSingle();
  return (data as ProductWithImages | null) ?? null;
}

export async function listCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured) return demoCategories;
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("position");
  return (data as Category[] | null) ?? [];
}

export interface CategoryWithCount extends Category {
  productCount: number;
}

/** Categorias + quantos produtos cada uma tem (para a tela de gestão). */
export async function listCategoriesWithCounts(): Promise<CategoryWithCount[]> {
  if (!isSupabaseConfigured) {
    return demoCategories.map((c) => ({
      ...c,
      productCount: demoProducts.filter((p) => p.category_id === c.id).length,
    }));
  }
  const supabase = await createClient();
  const [{ data: cats }, { data: prods }] = await Promise.all([
    supabase.from("categories").select("*").order("position"),
    supabase.from("products").select("category_id"),
  ]);
  const counts = new Map<string, number>();
  for (const p of (prods ?? []) as { category_id: string | null }[]) {
    if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
  }
  return ((cats ?? []) as Category[]).map((c) => ({
    ...c,
    productCount: counts.get(c.id) ?? 0,
  }));
}

const LOW_STOCK_THRESHOLD = 5;

export async function getDashboardData() {
  if (!isSupabaseConfigured) {
    // Sem pedidos demo, mas o estoque baixo espelha o catálogo da loja.
    const lowStock = demoProducts
      .filter((p) => p.is_active && p.stock <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => a.stock - b.stock)
      .map((p) => ({ id: p.id, name: p.name, stock: p.stock }));
    return {
      counts: { solicitado: 0, andamento: 0, entregue: 0 },
      revenueExpected: 0,
      lowStock,
      recent: [] as Order[],
    };
  }
  const supabase = await createClient();
  const [{ data: orders }, { data: low }] = await Promise.all([
    supabase.from("orders").select("id, status, total, created_at, order_number"),
    supabase
      .from("products")
      .select("id, name, stock")
      .lte("stock", LOW_STOCK_THRESHOLD)
      .eq("is_active", true)
      .order("stock", { ascending: true }),
  ]);

  const all = (orders as Pick<Order, "status" | "total">[] | null) ?? [];
  const andamento: OrderStatus[] = ["aceito", "em_separacao", "saiu_entrega"];
  const counts = {
    solicitado: all.filter((o) => o.status === "solicitado").length,
    andamento: all.filter((o) => andamento.includes(o.status)).length,
    entregue: all.filter((o) => o.status === "entregue").length,
  };
  const revenueExpected = all
    .filter((o) => [...andamento, "entregue"].includes(o.status))
    .reduce((acc, o) => acc + Number(o.total), 0);

  const recent = ((orders as Order[] | null) ?? [])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  return {
    counts,
    revenueExpected,
    lowStock: (low as { id: string; name: string; stock: number }[] | null) ?? [],
    recent,
  };
}

export async function getSetting<T = Record<string, unknown>>(key: string): Promise<T | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T | undefined) ?? null;
}

export async function getMessageTemplate(key: string): Promise<MessageTemplate | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("message_templates")
    .select("*")
    .eq("key", key)
    .maybeSingle();
  return (data as MessageTemplate | null) ?? null;
}
