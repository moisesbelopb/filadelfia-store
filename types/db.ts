/**
 * Tipos de domínio (espelho do schema em docs/schema.sql).
 * Pragmático: substitua por `supabase gen types typescript` quando o projeto
 * Supabase existir (gera types/database.ts completo).
 */

export type UserRole = "cliente" | "admin" | "super_admin";

export type OrderStatus =
  | "solicitado"
  | "aceito"
  | "em_separacao"
  | "saiu_entrega"
  | "entregue"
  | "recusado"
  | "cancelado";

export type PaymentMethod = "pix" | "dinheiro" | "cartao";
export type PaymentStatus = "pendente" | "pago";
export type InventoryMovementType = "entrada" | "reserva" | "liberacao" | "baixa" | "ajuste";
export type NotificationStatus = "pendente" | "enviado" | "erro";

export interface Address {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  whatsapp: string | null;
  role: UserRole;
  default_address: Address | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  position: number;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description_short: string | null;
  description_long: string | null;
  price: number;
  /** Estoque total (soma das variantes). Mantido para compat/relatórios. */
  stock: number;
  is_active: boolean;
  is_featured: boolean;
  /** Nome da cor exibido (ex.: "Off-White", "Preta"). */
  color_name: string | null;
  /** Cor em hex para o swatch (ex.: "#E8E1D3", "#141414"). */
  color_hex: string | null;
  /** Agrupa variações de cor do mesmo item (opcional; senão agrupa por categoria). */
  color_group: string | null;
  visual: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  storage_path: string;
  alt_text: string | null;
  position: number;
  is_primary: boolean;
  created_at: string;
}

/** Variante de produto = um tamanho, com estoque próprio. */
export interface ProductVariant {
  id: string;
  product_id: string;
  /** Rótulo do tamanho: "PP" | "P" | "M" | "G" | "GG" | "XGG" | "EXGG" | "2".."10". */
  size: string;
  stock: number;
  position: number;
  created_at?: string;
}

export interface ProductWithImages extends Product {
  product_images: ProductImage[];
  product_variants: ProductVariant[];
  category?: Pick<Category, "id" | "name" | "slug"> | null;
}

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: number;
  user_id: string;
  status: OrderStatus;
  customer_name: string;
  customer_whatsapp: string;
  /** Nulo em retirada na igreja (sem endereço de entrega). */
  address: Address | null;
  notes: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  /** "entrega" (motoboy) ou "retirada" (na igreja). */
  fulfillment_type: FulfillmentType;
  /** Data agendada (YYYY-MM-DD) ou nulo. */
  scheduled_date: string | null;
  /** Faixa de horário agendada (ex.: "14:00-18:00") ou nulo. */
  scheduled_window: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status_reason: string | null;
  accepted_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  /** Variante (tamanho) reservada — usada para liberar o estoque certo. */
  variant_id: string | null;
  /** Snapshot do tamanho no momento do pedido (ex.: "M"). */
  variant_size: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  created_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
  order_status_history?: OrderStatusHistory[];
}

export interface MessageTemplate {
  id: string;
  key: string;
  name: string;
  body: string;
  is_active: boolean;
  updated_at: string;
}

export interface NotificationLog {
  id: string;
  order_id: string | null;
  channel: string;
  template_key: string | null;
  phone: string | null;
  status: NotificationStatus;
  request: Record<string, unknown> | null;
  response: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
}

export interface PixSettings {
  chave: string;
  recebedor: string;
  banco?: string;
  observacao?: string;
  /** WhatsApp da loja p/ o cliente enviar o comprovante. Ex.: (11) 99999-9999 */
  whatsapp_loja?: string;
}

/** Um e-mail transacional editável (assunto/título/mensagem). */
export interface EmailTemplate {
  subject: string;
  heading: string;
  intro: string;
}

/**
 * Textos dos e-mails de pedido, editáveis no admin (settings key='email').
 * Um modelo por evento do fluxo. O status `saiu_entrega` tem dois modelos:
 * o cliente que retira recebe `order_ready_pickup`; o que recebe em casa,
 * `order_shipped`.
 */
export interface EmailSettings {
  order_placed: EmailTemplate;
  order_accepted: EmailTemplate;
  order_separated: EmailTemplate;
  order_ready_pickup: EmailTemplate;
  order_shipped: EmailTemplate;
  order_delivered: EmailTemplate;
  order_rejected: EmailTemplate;
  order_canceled: EmailTemplate;
}

/** Modo de recebimento do pedido. */
export type FulfillmentType = "entrega" | "retirada";

/** Taxa de entrega por cidade (o cliente paga = repasse ao motoboy). */
export interface CityFee {
  city: string;
  fee: number;
}

/** Faixa de disponibilidade: um dia da semana + intervalo de horário. */
export interface DeliverySlot {
  /** 0 = domingo … 6 = sábado. */
  weekday: number;
  /** "HH:MM" */
  start: string;
  /** "HH:MM" */
  end: string;
}

/** Configuração de entrega/retirada (settings key = "delivery"). */
export interface DeliverySettings {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  /** Taxa por cidade atendida (só entrega-se às cidades listadas). */
  cityFees: CityFee[];
  /** Dias/horários disponíveis para entrega. */
  deliverySchedule: DeliverySlot[];
  /** Dias/horários disponíveis para retirada na igreja. */
  pickupSchedule: DeliverySlot[];
  /** Quantos dias à frente o cliente pode agendar. */
  leadDays: number;
  /** Endereço da igreja para retirada. */
  pickupAddress?: string;
  /** Instruções extras de retirada. */
  pickupInfo?: string;
}
