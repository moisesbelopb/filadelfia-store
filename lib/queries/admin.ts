import "server-only";

import { isAdminUser, isOwnerUser } from "@/lib/auth";
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
  PaymentMethod,
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
  /** True para o dono do sistema (não pode ser excluído/desativado). */
  isOwner: boolean;
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
  isOwner: boolean;
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
      isOwner: isOwnerUser(u),
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

export async function listAdminOrders(
  status?: OrderStatus,
  q?: string,
  range?: DashboardRange,
): Promise<Order[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  let query = supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (range) query = query.gte("created_at", range.start).lte("created_at", range.end);
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

const LOW_STOCK_THRESHOLD = 3;

/** Intervalo de tempo (ISO) para recortar os números do dashboard por criação. */
export interface DashboardRange {
  start: string;
  end: string;
}

/** Item de alerta de estoque (por TAMANHO, que é onde o estoque é controlado). */
export interface StockAlertItem {
  id: string;
  product: string;
  size: string;
  stock: number;
}

/** Variantes zeradas (falta) e com pouco estoque (1..LOW_STOCK_THRESHOLD). */
async function fetchStockAlerts(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ falta: StockAlertItem[]; baixo: StockAlertItem[] }> {
  const { data } = await supabase
    .from("product_variants")
    .select("id, size, stock, product:products!inner(name, is_active)")
    .lte("stock", LOW_STOCK_THRESHOLD)
    .eq("product.is_active", true)
    .order("stock", { ascending: true });

  const items = (
    (data as unknown as {
      id: string;
      size: string;
      stock: number;
      product: { name: string } | null;
    }[]) ?? []
  ).map((v) => ({ id: v.id, product: v.product?.name ?? "—", size: v.size, stock: v.stock }));

  return {
    falta: items.filter((i) => i.stock === 0),
    baixo: items.filter((i) => i.stock > 0),
  };
}

/** Alertas de estoque a partir do catálogo demo (agregado, sem tamanho). */
function demoStockAlerts(): { falta: StockAlertItem[]; baixo: StockAlertItem[] } {
  const items = demoProducts
    .filter((p) => p.is_active && p.stock <= LOW_STOCK_THRESHOLD)
    .map((p) => ({ id: p.id, product: p.name, size: "—", stock: p.stock }));
  return { falta: items.filter((i) => i.stock === 0), baixo: items.filter((i) => i.stock > 0) };
}

export async function getDashboardData(range?: DashboardRange) {
  if (!isSupabaseConfigured) {
    return {
      counts: { solicitado: 0, andamento: 0, entregue: 0, cancelado: 0 },
      revenueExpected: 0,
      ordersTotal: 0,
      deliveries: { count: 0, fees: 0 },
      stock: demoStockAlerts(),
      recent: [] as Order[],
    };
  }
  const supabase = await createClient();
  // Pedidos recortados pelo período (por data de criação); estoque é sempre atual.
  let ordersQuery = supabase
    .from("orders")
    .select("id, status, total, created_at, order_number, fulfillment_type");
  if (range) {
    ordersQuery = ordersQuery.gte("created_at", range.start).lte("created_at", range.end);
  }
  const [{ data: orders }, stock, delivery] = await Promise.all([
    ordersQuery,
    fetchStockAlerts(supabase),
    // Entregas realizadas no período (por data da entrega) — base do repasse ao motoboy.
    getDeliveryReport(range),
  ]);

  const all = (orders as Pick<Order, "status" | "total">[] | null) ?? [];
  const andamento: OrderStatus[] = ["aceito", "em_separacao", "saiu_entrega"];
  const counts = {
    solicitado: all.filter((o) => o.status === "solicitado").length,
    andamento: all.filter((o) => andamento.includes(o.status)).length,
    entregue: all.filter((o) => o.status === "entregue").length,
    cancelado: all.filter((o) => o.status === "cancelado").length,
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
    ordersTotal: all.length,
    deliveries: { count: delivery.totals.count, fees: delivery.totals.fees },
    stock,
    recent,
  };
}

/** Uma linha do relatório de entregas (uma entrega realizada). */
export interface DeliveryReportRow {
  id: string;
  order_number: number;
  customer_name: string;
  address: Address | null;
  payment_method: PaymentMethod;
  total: number;
  delivery_fee: number;
  created_at: string;
  delivered_at: string | null;
}

export interface DeliveryReport {
  rows: DeliveryReportRow[];
  totals: { count: number; fees: number; orders: number };
}

/**
 * Entregas REALIZADAS (recebimento 'entrega' + status 'entregue') no período,
 * recortadas pela DATA DA ENTREGA (delivered_at) — é o que importa para repassar
 * as taxas ao motoboy. Retiradas na igreja não entram (não há motoboy/taxa).
 */
export async function getDeliveryReport(range?: DashboardRange): Promise<DeliveryReport> {
  if (!isSupabaseConfigured) return { rows: [], totals: { count: 0, fees: 0, orders: 0 } };
  const supabase = await createClient();

  let q = supabase
    .from("orders")
    .select(
      "id, order_number, customer_name, address, payment_method, total, delivery_fee, created_at, delivered_at",
    )
    .eq("fulfillment_type", "entrega")
    .eq("status", "entregue");
  if (range) q = q.gte("delivered_at", range.start).lte("delivered_at", range.end);

  const { data } = await q.order("delivered_at", { ascending: false });
  const rows = (data as DeliveryReportRow[] | null) ?? [];

  const totals = rows.reduce(
    (acc, r) => ({
      count: acc.count + 1,
      fees: acc.fees + Number(r.delivery_fee),
      orders: acc.orders + Number(r.total),
    }),
    { count: 0, fees: 0, orders: 0 },
  );

  return { rows, totals };
}

/** Uma linha do relatório de itens vendidos (por produto / tamanho / cor). */
export interface BreakdownRow {
  label: string;
  /** Unidades vendidas (soma de order_items.quantity). */
  units: number;
  /** Nº de pedidos distintos que incluíram este item. */
  orders: number;
}

export interface OrdersBreakdown {
  totalUnits: number;
  totalOrders: number;
  byProduct: BreakdownRow[];
  bySize: BreakdownRow[];
  byColor: BreakdownRow[];
  byPayment: BreakdownRow[];
  byFulfillment: BreakdownRow[];
  /** Cruzamento cor × tamanho: os tamanhos vendidos DENTRO de cada cor. */
  sizeByColor: ColorSizeGroup[];
}

/** Distribuição de tamanhos de uma cor (ex.: Preta → P:14, M:32, G:19). */
export interface ColorSizeGroup {
  color: string;
  total: number;
  sizes: BreakdownRow[];
}

/** Ordem natural de tamanhos de roupa; numéricos (infantil) vêm depois, em ordem. */
const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG", "XGG", "EXG", "EXGG"];
function sizeRank(size: string): number {
  const i = SIZE_ORDER.indexOf(size.trim().toUpperCase());
  if (i >= 0) return i;
  const n = Number(size);
  if (Number.isFinite(n)) return 100 + n;
  return 999;
}

type BreakdownItem = {
  order_id: string;
  product_id: string | null;
  product_name: string;
  variant_size: string | null;
  quantity: number;
};

/**
 * Relatório de demanda: quantidades vendidas por PRODUTO, TAMANHO e COR no
 * período. Considera pedidos NÃO cancelados/recusados (demanda real). A cor vem
 * do produto atual (o item não guarda cor); produto excluído/sem cor cai em
 * "Sem cor".
 */
export async function getOrdersBreakdown(
  range?: DashboardRange,
  categoryId?: string,
): Promise<OrdersBreakdown> {
  const empty: OrdersBreakdown = {
    totalUnits: 0,
    totalOrders: 0,
    byProduct: [],
    bySize: [],
    byColor: [],
    byPayment: [],
    byFulfillment: [],
    sizeByColor: [],
  };
  if (!isSupabaseConfigured) return empty;
  const supabase = await createClient();

  // 1) Pedidos do período; descarta cancelados/recusados (não são demanda real).
  let oq = supabase
    .from("orders")
    .select("id, status, payment_method, fulfillment_type, created_at");
  if (range) oq = oq.gte("created_at", range.start).lte("created_at", range.end);
  const { data: ordersData } = await oq;
  const validOrders = (
    (ordersData as
      | {
          id: string;
          status: OrderStatus;
          payment_method: PaymentMethod;
          fulfillment_type: string;
        }[]
      | null) ?? []
  ).filter((o) => o.status !== "cancelado" && o.status !== "recusado");
  const validIds = validOrders.map((o) => o.id);
  if (validIds.length === 0) return empty;

  // Metadados do pedido (pagamento / entrega) por id — atributos do PEDIDO, não do item.
  const PAYMENT_SHORT: Record<string, string> = {
    pix: "Pix",
    dinheiro: "Dinheiro",
    cartao: "Cartão",
  };
  const orderMeta = new Map<string, { payment: string; fulfillment: string }>();
  for (const o of validOrders) {
    orderMeta.set(o.id, {
      payment: PAYMENT_SHORT[o.payment_method] ?? o.payment_method,
      fulfillment: o.fulfillment_type === "retirada" ? "Retirada na igreja" : "Entrega",
    });
  }

  // 2) Itens desses pedidos (em lotes, p/ não estourar o filtro `in`).
  const items: BreakdownItem[] = [];
  const CHUNK = 300;
  for (let i = 0; i < validIds.length; i += CHUNK) {
    const { data } = await supabase
      .from("order_items")
      .select("order_id, product_id, product_name, variant_size, quantity")
      .in("order_id", validIds.slice(i, i + CHUNK));
    items.push(...((data as BreakdownItem[] | null) ?? []));
  }
  if (items.length === 0) return empty;

  // 3) Cor e categoria atuais de cada produto (o item não guarda cor/categoria).
  const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))] as string[];
  const colorById = new Map<string, string>();
  const categoryById = new Map<string, string>();
  if (productIds.length) {
    const { data: prods } = await supabase
      .from("products")
      .select("id, color_name, category_id")
      .in("id", productIds);
    for (const p of (prods as
      | { id: string; color_name: string | null; category_id: string | null }[]
      | null) ?? []) {
      if (p.color_name?.trim()) colorById.set(p.id, p.color_name.trim());
      if (p.category_id) categoryById.set(p.id, p.category_id);
    }
  }

  // Recorte por categoria (opcional): mantém só itens do produto naquela categoria.
  const scoped = categoryId
    ? items.filter((it) => it.product_id && categoryById.get(it.product_id) === categoryId)
    : items;

  // 4) Agrega: unidades (soma quantity) e pedidos distintos por chave.
  type Agg = { units: number; orders: Set<string> };
  const bump = (m: Map<string, Agg>, key: string, qty: number, orderId: string) => {
    const a = m.get(key) ?? { units: 0, orders: new Set<string>() };
    a.units += qty;
    a.orders.add(orderId);
    m.set(key, a);
  };
  const byProduct = new Map<string, Agg>();
  const bySize = new Map<string, Agg>();
  const byColor = new Map<string, Agg>();
  const byPayment = new Map<string, Agg>();
  const byFulfillment = new Map<string, Agg>();
  // Cruzamento cor × tamanho: por cor, um mapa de tamanho → agregado.
  const colorSize = new Map<string, Map<string, Agg>>();
  const allOrders = new Set<string>();
  let totalUnits = 0;
  for (const it of scoped) {
    const qty = Number(it.quantity) || 0;
    totalUnits += qty;
    allOrders.add(it.order_id);
    const size = it.variant_size?.trim() || "Sem tamanho";
    const color = (it.product_id && colorById.get(it.product_id)) || "Sem cor";
    bump(byProduct, it.product_name?.trim() || "—", qty, it.order_id);
    bump(bySize, size, qty, it.order_id);
    bump(byColor, color, qty, it.order_id);
    const inner = colorSize.get(color) ?? new Map<string, Agg>();
    bump(inner, size, qty, it.order_id);
    colorSize.set(color, inner);
    const meta = orderMeta.get(it.order_id);
    if (meta) {
      bump(byPayment, meta.payment, qty, it.order_id);
      bump(byFulfillment, meta.fulfillment, qty, it.order_id);
    }
  }

  const toRows = (m: Map<string, Agg>): BreakdownRow[] =>
    [...m.entries()]
      .map(([label, a]) => ({ label, units: a.units, orders: a.orders.size }))
      .sort((x, y) => y.units - x.units || x.label.localeCompare(y.label));

  // Cor × tamanho: cores por volume (maior primeiro); tamanhos em ordem natural.
  const sizeByColor: ColorSizeGroup[] = [...colorSize.entries()]
    .map(([color, sizes]) => {
      const rows = [...sizes.entries()]
        .map(([label, a]) => ({ label, units: a.units, orders: a.orders.size }))
        .sort((x, y) => sizeRank(x.label) - sizeRank(y.label) || x.label.localeCompare(y.label));
      return { color, total: rows.reduce((s, r) => s + r.units, 0), sizes: rows };
    })
    .sort((x, y) => y.total - x.total || x.color.localeCompare(y.color));

  return {
    totalUnits,
    totalOrders: allOrders.size,
    byProduct: toRows(byProduct),
    bySize: toRows(bySize),
    byColor: toRows(byColor),
    byPayment: toRows(byPayment),
    byFulfillment: toRows(byFulfillment),
    sizeByColor,
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
