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
  OrderPayment,
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
  /** Mesma info em matriz (linhas = tamanhos, colunas = cores) para a tabela. */
  sizeColorMatrix: SizeColorMatrix;
}

/** Distribuição de tamanhos de uma cor (ex.: Preta → P:14, M:32, G:19). */
export interface ColorSizeGroup {
  color: string;
  total: number;
  sizes: BreakdownRow[];
}

/** Matriz tamanho × cor (linhas = tamanhos, colunas = cores, com totais). */
export interface SizeColorMatrix {
  colors: { label: string; total: number }[];
  rows: { size: string; cells: number[]; total: number }[];
  grandTotal: number;
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
    sizeColorMatrix: { colors: [], rows: [], grandTotal: 0 },
  };
  if (!isSupabaseConfigured) return empty;
  const supabase = await createClient();
  const CHUNK = 300;

  // 1) (paralelo) Pedidos do período + cor/categoria de TODOS os produtos.
  // Catálogo é pequeno; buscar tudo de uma vez evita uma 3ª ida ao banco (distante)
  // dependente dos itens. Descarta cancelados/recusados (não são demanda real).
  let oq = supabase
    .from("orders")
    .select("id, status, payment_method, fulfillment_type, created_at");
  if (range) oq = oq.gte("created_at", range.start).lte("created_at", range.end);
  const [{ data: ordersData }, { data: prodMeta }] = await Promise.all([
    oq,
    supabase.from("products").select("id, color_name, category_id"),
  ]);

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

  // Cor e categoria atuais de cada produto (o item não guarda cor/categoria).
  const colorById = new Map<string, string>();
  const categoryById = new Map<string, string>();
  for (const p of (prodMeta as
    | { id: string; color_name: string | null; category_id: string | null }[]
    | null) ?? []) {
    if (p.color_name?.trim()) colorById.set(p.id, p.color_name.trim());
    if (p.category_id) categoryById.set(p.id, p.category_id);
  }

  // 2) Itens desses pedidos (lotes paralelos, p/ não estourar o filtro `in`).
  const chunks: string[][] = [];
  for (let i = 0; i < validIds.length; i += CHUNK) chunks.push(validIds.slice(i, i + CHUNK));
  const itemChunks = await Promise.all(
    chunks.map((c) =>
      supabase
        .from("order_items")
        .select("order_id, product_id, product_name, variant_size, quantity")
        .in("order_id", c),
    ),
  );
  const items: BreakdownItem[] = [];
  for (const { data } of itemChunks) items.push(...((data as BreakdownItem[] | null) ?? []));
  if (items.length === 0) return empty;

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

  // Mesma info em matriz: colunas = cores (por volume), linhas = tamanhos (ordem natural).
  const matrixColors = sizeByColor.map((g) => ({ label: g.color, total: g.total }));
  const matrixSizes = [...new Set([...colorSize.values()].flatMap((m) => [...m.keys()]))].sort(
    (a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b),
  );
  const sizeColorMatrix: SizeColorMatrix = {
    colors: matrixColors,
    rows: matrixSizes.map((size) => {
      const cells = matrixColors.map((c) => colorSize.get(c.label)?.get(size)?.units ?? 0);
      return { size, cells, total: cells.reduce((s, n) => s + n, 0) };
    }),
    grandTotal: matrixColors.reduce((s, c) => s + c.total, 0),
  };

  return {
    totalUnits,
    totalOrders: allOrders.size,
    byProduct: toRows(byProduct),
    bySize: toRows(bySize),
    byColor: toRows(byColor),
    byPayment: toRows(byPayment),
    byFulfillment: toRows(byFulfillment),
    sizeByColor,
    sizeColorMatrix,
  };
}

/** Um bloco financeiro: pedidos (valor), custo e lucro. */
export interface FinancialBucket {
  pedidos: number;
  custo: number;
  lucro: number;
  count: number;
}

export interface FinancialOverall {
  /** Todos os pedidos (recebido + a receber). */
  geral: FinancialBucket;
  /** Soma dos pagamentos recebidos. */
  recebido: FinancialBucket;
  /** Soma dos saldos devedores (a receber). */
  aReceber: FinancialBucket;
}

/** Recebido por forma de pagamento (só o recebido tem forma). */
export interface FinancialByMethod {
  method: PaymentMethod;
  label: string;
  bucket: FinancialBucket;
}

/**
 * Dados financeiros com PAGAMENTOS PARCIAIS. Cada pedido pode ter vários
 * pagamentos (order_payments). "Recebido" = soma dos pagamentos; "A receber" =
 * saldo devedor (total − recebido). Custo/Lucro dividem-se proporcionalmente ao
 * quanto foi recebido de cada pedido. "Recebido por forma" agrupa os pagamentos
 * pela sua forma; o "A receber" não tem forma (ainda não pago). Cancelados/
 * recusados ficam de fora; produto sem custo cadastrado conta zero.
 */
export async function getFinancialData(range?: DashboardRange): Promise<{
  overall: FinancialOverall;
  byMethod: FinancialByMethod[];
}> {
  const empty = (): FinancialBucket => ({ pedidos: 0, custo: 0, lucro: 0, count: 0 });
  const METHODS: { method: PaymentMethod; label: string }[] = [
    { method: "pix", label: "Pix" },
    { method: "cartao", label: "Cartão de crédito" },
    { method: "dinheiro", label: "Dinheiro" },
  ];
  const emptyResult = {
    overall: { geral: empty(), recebido: empty(), aReceber: empty() },
    byMethod: METHODS.map((m) => ({ ...m, bucket: empty() })),
  };
  if (!isSupabaseConfigured) return emptyResult;
  const supabase = await createClient();
  const CHUNK = 300;

  // Passo 1 (paralelo): pedidos do período + custo de TODOS os produtos.
  // Banco fica longe (~130ms/ida), então buscamos o custo do catálogo inteiro de
  // uma vez — é pequeno — em vez de uma 2ª ida dependente dos itens.
  let oq = supabase.from("orders").select("id, total, status, created_at");
  if (range) oq = oq.gte("created_at", range.start).lte("created_at", range.end);
  const [{ data: ordersData }, { data: prodCosts }] = await Promise.all([
    oq,
    supabase.from("products").select("id, cost_price"),
  ]);

  const orders = (
    (ordersData as { id: string; total: number; status: OrderStatus }[] | null) ?? []
  ).filter((o) => o.status !== "cancelado" && o.status !== "recusado");
  if (orders.length === 0) return emptyResult;
  const ids = orders.map((o) => o.id);

  const costById = new Map<string, number>();
  for (const p of (prodCosts as { id: string; cost_price: number | null }[] | null) ?? []) {
    costById.set(p.id, Number(p.cost_price) || 0);
  }

  // Passo 2 (paralelo): pagamentos + itens desses pedidos, em lotes paralelos.
  // Resiliente: query do supabase-js não lança — em erro (ex.: tabela ausente),
  // data vem null e vira [].
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
  const [payChunks, itemChunks] = await Promise.all([
    Promise.all(
      chunks.map((c) =>
        supabase.from("order_payments").select("order_id, method, amount, kind").in("order_id", c),
      ),
    ),
    Promise.all(
      chunks.map((c) =>
        supabase.from("order_items").select("order_id, product_id, quantity").in("order_id", c),
      ),
    ),
  ]);

  const paysByOrder = new Map<string, { method: PaymentMethod; amount: number; kind: string }[]>();
  for (const { data } of payChunks) {
    for (const p of (data as
      | { order_id: string; method: PaymentMethod; amount: number; kind: string }[]
      | null) ?? []) {
      const arr = paysByOrder.get(p.order_id) ?? [];
      arr.push({ method: p.method, amount: Number(p.amount), kind: p.kind });
      paysByOrder.set(p.order_id, arr);
    }
  }

  const costByOrder = new Map<string, number>();
  for (const { data } of itemChunks) {
    for (const it of (data as
      | { order_id: string; product_id: string | null; quantity: number }[]
      | null) ?? []) {
      const c = (it.product_id && costById.get(it.product_id)) || 0;
      costByOrder.set(it.order_id, (costByOrder.get(it.order_id) ?? 0) + c * it.quantity);
    }
  }

  const overall = { geral: empty(), recebido: empty(), aReceber: empty() };
  const byMethodMap = new Map<PaymentMethod, FinancialBucket>(
    METHODS.map((m) => [m.method, empty()]),
  );

  for (const o of orders) {
    const total = Number(o.total);
    const cost = costByOrder.get(o.id) ?? 0;
    const pays = paysByOrder.get(o.id) ?? [];
    // Estornos subtraem do recebido.
    const net = pays.reduce((s, p) => s + (p.kind === "estorno" ? -p.amount : p.amount), 0);
    const paid = Math.min(total, Math.max(0, net));
    const saldo = Math.max(0, total - paid);
    const paidRatio = total > 0 ? paid / total : 0;

    overall.geral.pedidos += total;
    overall.geral.custo += cost;
    overall.geral.count += 1;

    if (paid > 0) {
      overall.recebido.pedidos += paid;
      overall.recebido.custo += cost * paidRatio;
      overall.recebido.count += 1;
    }
    if (saldo > 0) {
      overall.aReceber.pedidos += saldo;
      overall.aReceber.custo += cost * (1 - paidRatio);
      overall.aReceber.count += 1;
    }
    for (const p of pays) {
      const b = byMethodMap.get(p.method);
      if (!b) continue;
      const signed = p.kind === "estorno" ? -p.amount : p.amount;
      const capped = Math.max(-total, Math.min(signed, total));
      b.pedidos += signed;
      b.custo += total > 0 ? cost * (capped / total) : 0;
      if (p.kind !== "estorno") b.count += 1;
    }
  }

  for (const b of [overall.geral, overall.recebido, overall.aReceber, ...byMethodMap.values()]) {
    b.lucro = b.pedidos - b.custo;
  }

  return {
    overall,
    byMethod: METHODS.map((m) => ({
      ...m,
      bucket: byMethodMap.get(m.method) ?? empty(),
    })),
  };
}

/** Um comprovante de pagamento anexado ao pedido (URL assinada temporária). */
export interface OrderReceipt {
  name: string;
  url: string;
  size: number;
  createdAt: string;
  isPdf: boolean;
}

/**
 * Comprovantes de pagamento de um pedido (bucket privado `comprovantes`, uma
 * pasta por pedido). Gera URL assinada (1h) para cada arquivo. Service role
 * porque o bucket é privado — nunca exposto publicamente.
 */
export async function getOrderReceipts(orderId: string): Promise<OrderReceipt[]> {
  if (!isSupabaseConfigured) return [];
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  const { data: files } = await admin.storage
    .from("comprovantes")
    .list(orderId, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  const list = (files ?? []).filter((f) => f.name !== ".emptyFolderPlaceholder");
  if (list.length === 0) return [];

  // Assina todos os arquivos numa única ida ao Storage (era 1 por arquivo).
  const { data: signed } = await admin.storage.from("comprovantes").createSignedUrls(
    list.map((f) => `${orderId}/${f.name}`),
    60 * 60,
  );
  const urlByPath = new Map(
    ((signed as { path?: string | null; signedUrl: string }[] | null) ?? []).map((s) => [
      s.path ?? "",
      s.signedUrl,
    ]),
  );
  return list.map((f) => ({
    name: f.name,
    url: urlByPath.get(`${orderId}/${f.name}`) ?? "",
    size: (f.metadata?.size as number | undefined) ?? 0,
    createdAt: f.created_at ?? "",
    isPdf: f.name.toLowerCase().endsWith(".pdf"),
  }));
}

/** Pagamentos registrados de um pedido (parciais/total), do mais antigo. */
export async function getOrderPayments(orderId: string): Promise<OrderPayment[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_payments")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  return (data as OrderPayment[] | null) ?? [];
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
