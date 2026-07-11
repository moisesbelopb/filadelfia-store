-- ============================================================
-- Casa de Filadélfia — Schema Postgres (Supabase)
-- Modelagem de referência das 14 tabelas do plano.
-- Convenções:
--   • IDs: uuid (gen_random_uuid)  • Timestamps: timestamptz
--   • Dinheiro: numeric(12,2) em BRL (exato)
--   • Cada bloco indica a FASE em que entra.
-- RLS fica em rls.sql. O trigger da FSM fica em fsm-pedidos.md.
-- ============================================================

create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ---------- Tipos ENUM ----------
create type user_role as enum ('cliente','admin','super_admin');

create type order_status as enum (
  'solicitado','aceito','em_separacao','saiu_entrega','entregue',
  'recusado','cancelado'
);

create type payment_method as enum ('pix','dinheiro','cartao');
create type payment_status as enum ('pendente','pago');

create type inventory_movement_type as enum (
  'entrada','reserva','liberacao','baixa','ajuste'
);

create type notification_status as enum ('pendente','enviado','erro');

-- ---------- Helper: updated_at ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============================================================
-- FASE 2 — profiles (papel do usuário)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  whatsapp text,
  role user_role not null default 'cliente',
  default_address jsonb,                     -- pré-preenche o checkout
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o profile automaticamente ao registrar no Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, whatsapp)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'whatsapp'
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- FASE 4 — categories / products / product_images
-- ============================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description_short text,
  description_long text,
  price numeric(12,2) not null check (price >= 0),
  stock int not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  is_featured boolean not null default false,   -- destaque
  visual jsonb,                                  -- cor/badge do card, etc.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_products_category on public.products(category_id);
create index idx_products_active on public.products(is_active) where is_active;
create index idx_products_featured on public.products(is_featured) where is_featured;
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,                    -- bucket 'product-images'
  alt_text text,
  position int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_product_images_product on public.product_images(product_id);
-- Garante no máximo 1 imagem principal por produto.
create unique index uq_product_primary_image
  on public.product_images(product_id) where is_primary;

-- ============================================================
-- FASE 5 — carts / cart_items
-- (guest cart vive no client via Zustand e faz merge no login)
-- ============================================================
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_carts_updated before update on public.carts
  for each row execute function public.set_updated_at();

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity int not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id)
);
create index idx_cart_items_cart on public.cart_items(cart_id);
create trigger trg_cart_items_updated before update on public.cart_items
  for each row execute function public.set_updated_at();

-- ============================================================
-- FASE 5/6 — orders / order_items / order_status_history
-- ============================================================
create sequence if not exists public.order_number_seq start 1000;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint not null default nextval('public.order_number_seq') unique,
  user_id uuid not null references public.profiles(id) on delete restrict,
  status order_status not null default 'solicitado',
  -- Snapshot do cliente no momento do pedido:
  customer_name text not null,
  customer_whatsapp text not null,
  address jsonb not null,           -- {street,number,complement,neighborhood,city,state,zip}
  notes text,
  payment_method payment_method not null,
  payment_status payment_status not null default 'pendente',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total numeric(12,2) not null check (total >= 0),
  status_reason text,               -- motivo de recusa/cancelamento
  accepted_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_orders_user on public.orders(user_id);
create index idx_orders_status on public.orders(status);
create index idx_orders_created on public.orders(created_at desc);
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,       -- snapshot (imutável)
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity int not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);
create index idx_order_items_order on public.order_items(order_id);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status order_status,
  to_status order_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);
create index idx_status_history_order on public.order_status_history(order_id);

-- ============================================================
-- FASE 8 — inventory_movements
-- quantity é sempre positivo; a semântica vem de 'type'.
-- ============================================================
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  type inventory_movement_type not null,
  quantity int not null check (quantity > 0),
  order_id uuid references public.orders(id) on delete set null,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_inventory_product on public.inventory_movements(product_id);
create index idx_inventory_order on public.inventory_movements(order_id);

-- ============================================================
-- FASE 7 — message_templates / notification_logs / settings
-- ============================================================
create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,         -- 'pix','order_accepted','saiu_entrega'...
  name text not null,
  body text not null,               -- texto com {{variaveis}}
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger trg_templates_updated before update on public.message_templates
  for each row execute function public.set_updated_at();

create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  channel text not null default 'whatsapp',
  template_key text,
  phone text,
  status notification_status not null default 'pendente',
  request jsonb,                    -- payload enviado à Evolution
  response jsonb,                   -- resposta da Evolution
  error text,
  created_at timestamptz not null default now()
);
create index idx_notif_order on public.notification_logs(order_id);

-- Configurações gerais (loja, PWA, visual) + config Pix (NÃO-secreta).
-- A API key da Evolution fica em env server-side, nunca aqui.
create table public.settings (
  key text primary key,             -- 'pix','store','pwa','visual','evolution'
  value jsonb not null,
  is_public boolean not null default false,  -- true = leitura liberada para anon/cliente
  updated_at timestamptz not null default now()
);
create trigger trg_settings_updated before update on public.settings
  for each row execute function public.set_updated_at();

-- ============================================================
-- FASE 2+ — audit_logs (trilha de auditoria administrativa)
-- ============================================================
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,             -- 'order.accept','product.update'...
  entity_type text,
  entity_id text,
  metadata jsonb,
  ip inet,
  created_at timestamptz not null default now()
);
create index idx_audit_actor on public.audit_logs(actor_id);
create index idx_audit_entity on public.audit_logs(entity_type, entity_id);
create index idx_audit_created on public.audit_logs(created_at desc);

-- ============================================================
-- Próximos passos:
--   • rls.sql          → habilitar RLS + políticas
--   • fsm-pedidos.md   → trigger de validação de transição + histórico
-- Estas migrations serão versionadas em supabase/migrations na Fase 1/2.
-- ============================================================
