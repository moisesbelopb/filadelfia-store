-- ============================================================
-- SETUP COMPLETO — Casa de Filadélfia
-- Cole TUDO isto no SQL Editor do Supabase e clique em RUN.
-- Rode apenas UMA vez (cria tabelas, regras, storage e dados de exemplo).
-- ============================================================


-- ========================= 0001_schema =========================

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


-- ========================= 0002_rls =========================

-- ============================================================
-- Casa de Filadélfia — Row Level Security (Supabase)
-- Aplicar DEPOIS de schema.sql.
-- Princípio: cliente só enxerga/edita o que é dele; admin gerencia tudo;
-- catálogo é público (somente itens ativos para não-admin).
-- ============================================================

-- ---------- Função auxiliar: is_admin() ----------
-- SECURITY DEFINER evita recursão de RLS ao ler a própria 'profiles'.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','super_admin')
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ============================================================
-- Habilita RLS em todas as tabelas expostas
-- ============================================================
alter table public.profiles              enable row level security;
alter table public.categories            enable row level security;
alter table public.products              enable row level security;
alter table public.product_images        enable row level security;
alter table public.carts                 enable row level security;
alter table public.cart_items            enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.order_status_history  enable row level security;
alter table public.inventory_movements   enable row level security;
alter table public.message_templates     enable row level security;
alter table public.notification_logs     enable row level security;
alter table public.settings              enable row level security;
alter table public.audit_logs            enable row level security;

-- ============================================================
-- profiles
-- ============================================================
create policy "profiles: dono lê o próprio"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles: dono atualiza o próprio (sem trocar role)"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "profiles: admin gerencia"
  on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());
-- Obs.: mudança de role só via admin ou service_role.

-- ============================================================
-- categories — leitura pública (ativas); escrita admin
-- ============================================================
create policy "categories: leitura pública (ativas)"
  on public.categories for select
  using (is_active or public.is_admin());

create policy "categories: admin gerencia"
  on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- products — leitura pública (ativos); escrita admin
-- ============================================================
create policy "products: leitura pública (ativos)"
  on public.products for select
  using (is_active or public.is_admin());

create policy "products: admin gerencia"
  on public.products for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- product_images — segue a visibilidade do produto
-- ============================================================
create policy "product_images: leitura pública (produto ativo)"
  on public.product_images for select
  using (
    public.is_admin() or exists (
      select 1 from public.products p
      where p.id = product_id and p.is_active
    )
  );

create policy "product_images: admin gerencia"
  on public.product_images for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- carts / cart_items — apenas o dono
-- ============================================================
create policy "carts: dono gerencia"
  on public.carts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "cart_items: dono gerencia"
  on public.cart_items for all
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));

-- ============================================================
-- orders — cliente lê os seus e cria; NÃO altera status (só admin).
-- A criação/checkout deve passar por Server Action (validação de estoque).
-- ============================================================
create policy "orders: cliente lê os próprios"
  on public.orders for select
  using (user_id = auth.uid() or public.is_admin());

create policy "orders: cliente cria o próprio"
  on public.orders for insert
  with check (user_id = auth.uid() and status = 'solicitado');

create policy "orders: admin gerencia (status, etc.)"
  on public.orders for update
  using (public.is_admin()) with check (public.is_admin());
-- Cliente NÃO recebe policy de UPDATE → não altera status.
-- Cancelamento pelo cliente (se permitido) passa por Server Action controlada.

-- ============================================================
-- order_items — leitura pela posse do pedido; escrita via server
-- ============================================================
create policy "order_items: leitura pela posse do pedido"
  on public.order_items for select
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())
  ));

create policy "order_items: cliente insere itens do próprio pedido"
  on public.order_items for insert
  with check (exists (
    select 1 from public.orders o
    where o.id = order_id and o.user_id = auth.uid() and o.status = 'solicitado'
  ) or public.is_admin());

create policy "order_items: admin gerencia"
  on public.order_items for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- order_status_history — leitura pela posse; escrita via trigger/admin
-- ============================================================
create policy "status_history: leitura pela posse do pedido"
  on public.order_status_history for select
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())
  ));

create policy "status_history: admin insere"
  on public.order_status_history for insert
  with check (public.is_admin());
-- Inserção automática vem do trigger da FSM (SECURITY DEFINER), que ignora RLS.

-- ============================================================
-- Tabelas exclusivas do admin
-- ============================================================
create policy "inventory: admin gerencia"
  on public.inventory_movements for all
  using (public.is_admin()) with check (public.is_admin());

create policy "templates: admin gerencia"
  on public.message_templates for all
  using (public.is_admin()) with check (public.is_admin());

create policy "notification_logs: admin lê"
  on public.notification_logs for select
  using (public.is_admin());
-- Inserção de logs vem do backend (service_role / SECURITY DEFINER), ignora RLS.

create policy "audit_logs: admin lê"
  on public.audit_logs for select
  using (public.is_admin());
-- Inserção de auditoria vem do backend (service_role), ignora RLS.

-- ============================================================
-- settings — chaves públicas (visual/PWA) liberadas; resto só admin
-- ============================================================
create policy "settings: leitura pública das chaves marcadas"
  on public.settings for select
  using (is_public or public.is_admin());

create policy "settings: admin gerencia"
  on public.settings for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Storage (bucket 'product-images')
-- Configurar no painel/policies do Storage:
--   • SELECT público (bucket público de leitura), ou assinado.
--   • INSERT/UPDATE/DELETE apenas is_admin().
--   • Validar mime-type (image/*) e tamanho no upload (Server Action).
-- ============================================================


-- ========================= 0003_order_fsm =========================

-- ============================================================
-- FASE 6 — Máquina de estados do pedido (FSM)
-- Autoridade da transição fica no banco. Ver docs/fsm-pedidos.md.
-- ============================================================

-- Mapa de transições válidas.
create or replace function public.order_transition_allowed(
  from_s order_status, to_s order_status
) returns boolean language sql immutable as $$
  select case from_s
    when 'solicitado'   then to_s in ('aceito','recusado','cancelado')
    when 'aceito'       then to_s in ('em_separacao','cancelado')
    when 'em_separacao' then to_s in ('saiu_entrega','cancelado')
    when 'saiu_entrega' then to_s in ('entregue','cancelado')
    else false  -- entregue / recusado / cancelado são finais
  end;
$$;

-- Valida a transição e regras antes de gravar.
create or replace function public.enforce_order_transition()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if not public.order_transition_allowed(old.status, new.status) then
      raise exception 'Transição inválida: % -> %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    -- Motivo obrigatório em recusa/cancelamento.
    if new.status in ('recusado','cancelado')
       and coalesce(nullif(trim(new.status_reason), ''), '') = '' then
      raise exception 'Informe o motivo para % o pedido', new.status
        using errcode = 'check_violation';
    end if;

    -- Timestamps de negócio.
    if new.status = 'aceito'   and new.accepted_at  is null then new.accepted_at  := now(); end if;
    if new.status = 'entregue' and new.delivered_at is null then new.delivered_at := now(); end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_order_transition on public.orders;
create trigger trg_enforce_order_transition
  before update on public.orders
  for each row execute function public.enforce_order_transition();

-- Registra histórico após a mudança de status.
create or replace function public.log_order_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_status_history
      (order_id, from_status, to_status, changed_by, reason)
    values (new.id, old.status, new.status, auth.uid(), new.status_reason);
  end if;
  return new;
end $$;

drop trigger if exists trg_log_order_status on public.orders;
create trigger trg_log_order_status
  after update on public.orders
  for each row execute function public.log_order_status();

-- Histórico inicial ao criar o pedido (status 'solicitado').
create or replace function public.log_order_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (new.id, null, new.status, new.user_id);
  return new;
end $$;

drop trigger if exists trg_log_order_created on public.orders;
create trigger trg_log_order_created
  after insert on public.orders
  for each row execute function public.log_order_created();


-- ========================= 0004_orders_inventory =========================

-- ============================================================
-- FASE 5/8 — Criação de pedido (transação) + efeitos de estoque
-- Modelo: products.stock = disponível para venda.
--   • reserva   (solicitado): stock -= qty
--   • liberacao (recusado/cancelado): stock += qty
--   • baixa     (entregue): registra consumo (sem alterar stock)
-- ============================================================

-- ---------- create_order: checkout atômico ----------
create or replace function public.create_order(
  p_customer_name text,
  p_customer_whatsapp text,
  p_address jsonb,
  p_notes text,
  p_payment_method payment_method
) returns table (order_id uuid, order_number bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_cart_id uuid;
  v_order_id uuid;
  v_order_number bigint;
  v_subtotal numeric(12,2) := 0;
  r record;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = 'insufficient_privilege';
  end if;

  select id into v_cart_id from public.carts where user_id = v_uid;
  if v_cart_id is null then
    raise exception 'Carrinho vazio';
  end if;

  -- Valida estoque e trava as linhas dos produtos do carrinho.
  for r in
    select ci.product_id, ci.quantity, p.name, p.price, p.stock, p.is_active
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    where ci.cart_id = v_cart_id
    for update of p
  loop
    if not r.is_active then
      raise exception 'Produto indisponível: %', r.name;
    end if;
    if r.stock < r.quantity then
      raise exception 'Estoque insuficiente para %: disponível %', r.name, r.stock;
    end if;
    v_subtotal := v_subtotal + (r.price * r.quantity);
  end loop;

  if v_subtotal = 0 then
    raise exception 'Carrinho vazio';
  end if;

  -- Cria o pedido (status solicitado).
  insert into public.orders (
    user_id, status, customer_name, customer_whatsapp, address, notes,
    payment_method, subtotal, delivery_fee, total
  ) values (
    v_uid, 'solicitado', p_customer_name, p_customer_whatsapp, p_address, p_notes,
    p_payment_method, v_subtotal, 0, v_subtotal
  ) returning id, orders.order_number into v_order_id, v_order_number;

  -- Itens (snapshot) + reserva de estoque.
  for r in
    select ci.product_id, ci.quantity, p.name, p.price
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    where ci.cart_id = v_cart_id
  loop
    insert into public.order_items
      (order_id, product_id, product_name, unit_price, quantity, line_total)
    values (v_order_id, r.product_id, r.name, r.price, r.quantity, r.price * r.quantity);

    update public.products set stock = stock - r.quantity where id = r.product_id;

    insert into public.inventory_movements
      (product_id, type, quantity, order_id, reason, created_by)
    values (r.product_id, 'reserva', r.quantity, v_order_id, 'Reserva por pedido', v_uid);
  end loop;

  -- Limpa o carrinho.
  delete from public.cart_items where cart_id = v_cart_id;

  return query select v_order_id, v_order_number;
end $$;

grant execute on function
  public.create_order(text, text, jsonb, text, payment_method) to authenticated;

-- ---------- Efeitos de estoque nas mudanças de status ----------
create or replace function public.apply_inventory_on_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status is distinct from old.status then
    if new.status in ('recusado', 'cancelado') then
      for r in
        select product_id, quantity from public.order_items
        where order_id = new.id and product_id is not null
      loop
        update public.products set stock = stock + r.quantity where id = r.product_id;
        insert into public.inventory_movements
          (product_id, type, quantity, order_id, reason, created_by)
        values (r.product_id, 'liberacao', r.quantity, new.id,
                'Liberação por ' || new.status, auth.uid());
      end loop;
    elsif new.status = 'entregue' then
      for r in
        select product_id, quantity from public.order_items
        where order_id = new.id and product_id is not null
      loop
        insert into public.inventory_movements
          (product_id, type, quantity, order_id, reason, created_by)
        values (r.product_id, 'baixa', r.quantity, new.id, 'Baixa por entrega', auth.uid());
      end loop;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_apply_inventory_on_status on public.orders;
create trigger trg_apply_inventory_on_status
  after update on public.orders
  for each row execute function public.apply_inventory_on_status();


-- ========================= 0005_storage =========================

-- ============================================================
-- FASE 4 — Storage: bucket de imagens de produto
-- Leitura pública; escrita apenas para admin (is_admin()).
-- ============================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Escrita restrita ao admin. (Leitura é liberada pelo bucket público.)
create policy "product-images: admin insere"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "product-images: admin atualiza"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

create policy "product-images: admin remove"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());


-- ========================= 0006_product_variants =========================

-- ============================================================
-- Casa de Filadélfia — Variantes de produto (estoque por tamanho) + cor
-- Coleção "Multiplicação": cada produto = 1 cor/público; o tamanho vira
-- variante com estoque próprio.
-- Aplicar DEPOIS de 0001_schema.sql / 0002_rls.sql.
-- ============================================================

-- ---------- products: cor exibida no card / seletor ----------
alter table public.products
  add column if not exists color_name text,   -- ex.: 'Off-White', 'Preta'
  add column if not exists color_hex  text;   -- ex.: '#E7E0D0', '#161616'

-- ---------- product_variants: um tamanho, com estoque próprio ----------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,                          -- 'PP','P','M','G','GG','XGG','EXGG' | '2'..'10'
  stock int not null default 0 check (stock >= 0),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size)
);
create index if not exists idx_product_variants_product on public.product_variants(product_id);
create trigger trg_product_variants_updated before update on public.product_variants
  for each row execute function public.set_updated_at();

-- Mantém products.stock como soma das variantes (relatórios / low-stock).
create or replace function public.sync_product_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
     set stock = coalesce((
       select sum(v.stock) from public.product_variants v where v.product_id = pid
     ), 0)
   where p.id = pid;
  return null;
end $$;

create trigger trg_variants_sync_stock
  after insert or update or delete on public.product_variants
  for each row execute function public.sync_product_stock();

-- ---------- cart_items / order_items: carregar o tamanho ----------
-- Referência opcional à variante no carrinho (chave por produto+tamanho).
alter table public.cart_items
  add column if not exists variant_id uuid references public.product_variants(id) on delete cascade;

-- Snapshot do tamanho no item do pedido (imutável).
alter table public.order_items
  add column if not exists variant_size text;

-- Troca a unicidade do carrinho para (cart, produto, variante).
alter table public.cart_items drop constraint if exists cart_items_cart_id_product_id_key;
create unique index if not exists uq_cart_items_variant
  on public.cart_items(cart_id, product_id, variant_id);

-- ============================================================
-- RLS — variantes seguem a visibilidade do produto (igual product_images)
-- ============================================================
alter table public.product_variants enable row level security;

create policy "product_variants: leitura pública (produto ativo)"
  on public.product_variants for select
  using (
    public.is_admin() or exists (
      select 1 from public.products p
      where p.id = product_id and p.is_active
    )
  );

create policy "product_variants: admin gerencia"
  on public.product_variants for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- NOTA (follow-up de backend): a RPC create_order deve reservar/baixar
-- estoque por VARIANTE (product_variants.stock) e gravar order_items.variant_size.
-- Enquanto não migrada, o checkout agrega por product_id.
-- ============================================================


-- ========================= 0007_delivery =========================

-- ============================================================
-- FASE — Entrega x Retirada + agendamento + taxa de entrega
-- ============================================================

-- Novas colunas em orders.
alter table public.orders
  add column if not exists fulfillment_type text not null default 'entrega'
    check (fulfillment_type in ('entrega', 'retirada')),
  add column if not exists scheduled_date date,
  add column if not exists scheduled_window text;

-- Retirada na igreja não tem endereço de entrega.
alter table public.orders alter column address drop not null;

-- ---------- create_order: agora com modo, agendamento e taxa ----------
-- Remove a versão antiga (assinatura menor) para não deixar overload ambíguo.
drop function if exists public.create_order(text, text, jsonb, text, payment_method);

create or replace function public.create_order(
  p_customer_name text,
  p_customer_whatsapp text,
  p_address jsonb,
  p_notes text,
  p_payment_method payment_method,
  p_fulfillment_type text,
  p_scheduled_date date,
  p_scheduled_window text,
  p_delivery_fee numeric
) returns table (order_id uuid, order_number bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_cart_id uuid;
  v_order_id uuid;
  v_order_number bigint;
  v_subtotal numeric(12,2) := 0;
  v_fee numeric(12,2) := coalesce(p_delivery_fee, 0);
  r record;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = 'insufficient_privilege';
  end if;

  if p_fulfillment_type not in ('entrega', 'retirada') then
    raise exception 'Modo de recebimento inválido';
  end if;
  -- Retirada não cobra taxa; segurança contra valor negativo.
  if p_fulfillment_type = 'retirada' then
    v_fee := 0;
  elsif v_fee < 0 then
    v_fee := 0;
  end if;

  select id into v_cart_id from public.carts where user_id = v_uid;
  if v_cart_id is null then
    raise exception 'Carrinho vazio';
  end if;

  -- Valida estoque e trava as linhas dos produtos do carrinho.
  for r in
    select ci.product_id, ci.quantity, p.name, p.price, p.stock, p.is_active
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    where ci.cart_id = v_cart_id
    for update of p
  loop
    if not r.is_active then
      raise exception 'Produto indisponível: %', r.name;
    end if;
    if r.stock < r.quantity then
      raise exception 'Estoque insuficiente para %: disponível %', r.name, r.stock;
    end if;
    v_subtotal := v_subtotal + (r.price * r.quantity);
  end loop;

  if v_subtotal = 0 then
    raise exception 'Carrinho vazio';
  end if;

  -- Cria o pedido (status solicitado).
  insert into public.orders (
    user_id, status, customer_name, customer_whatsapp, address, notes,
    payment_method, fulfillment_type, scheduled_date, scheduled_window,
    subtotal, delivery_fee, total
  ) values (
    v_uid, 'solicitado', p_customer_name, p_customer_whatsapp, p_address, p_notes,
    p_payment_method, p_fulfillment_type, p_scheduled_date, p_scheduled_window,
    v_subtotal, v_fee, v_subtotal + v_fee
  ) returning id, orders.order_number into v_order_id, v_order_number;

  -- Itens (snapshot) + reserva de estoque.
  for r in
    select ci.product_id, ci.quantity, p.name, p.price
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    where ci.cart_id = v_cart_id
  loop
    insert into public.order_items
      (order_id, product_id, product_name, unit_price, quantity, line_total)
    values (v_order_id, r.product_id, r.name, r.price, r.quantity, r.price * r.quantity);

    update public.products set stock = stock - r.quantity where id = r.product_id;

    insert into public.inventory_movements
      (product_id, type, quantity, order_id, reason, created_by)
    values (r.product_id, 'reserva', r.quantity, v_order_id, 'Reserva por pedido', v_uid);
  end loop;

  -- Limpa o carrinho.
  delete from public.cart_items where cart_id = v_cart_id;

  return query select v_order_id, v_order_number;
end $$;

grant execute on function
  public.create_order(text, text, jsonb, text, payment_method, text, date, text, numeric)
  to authenticated;


-- ========================= seed (dados de exemplo) =========================

-- ============================================================
-- Seed de desenvolvimento — Casa de Filadélfia
-- Coleção "Multiplicação": Off-White e Preta, para Feminino, Masculino e
-- Infantil, com estoque por tamanho (product_variants).
-- Rode após as migrations (inclui 0006_product_variants.sql).
-- Espelha lib/demo-data.ts.
-- ============================================================

-- Categorias
insert into public.categories (name, slug, position) values
  ('Feminino', 'feminino', 1),
  ('Masculino', 'masculino', 2),
  ('Infantil', 'infantil', 3)
on conflict (slug) do nothing;

-- Produtos (2 cores × 3 públicos)
insert into public.products
  (category_id, name, slug, description_short, description_long, price,
   color_name, color_hex, is_active, is_featured)
select c.id, v.name, v.slug, v.ds, v.dl, v.price, v.color, v.hex, true, v.feat
from (values
  ('feminino',  'Camiseta Multiplicação Off-White · Feminino',
     'camiseta-multiplicacao-off-white-feminino',
     'Camiseta oversized Off-White · Coleção Multiplicação',
     'Camiseta oversized da coleção Multiplicação. A estampa traduz o milagre dos pães e peixes: 5 pães + 2 peixes = MULTIPLICAÇÃO. Malha 100% algodão penteado fio 30.1, gola careca reforçada e caimento amplo.',
     49.90, 'Off-White', '#E7E0D0', true),
  ('feminino',  'Camiseta Multiplicação Preta · Feminino',
     'camiseta-multiplicacao-preta-feminino',
     'Camiseta oversized Preta · Coleção Multiplicação',
     'Camiseta oversized da coleção Multiplicação. A estampa traduz o milagre dos pães e peixes: 5 pães + 2 peixes = MULTIPLICAÇÃO. Malha 100% algodão penteado fio 30.1, gola careca reforçada e caimento amplo.',
     49.90, 'Preta', '#161616', true),
  ('masculino', 'Camiseta Multiplicação Off-White · Masculino',
     'camiseta-multiplicacao-off-white-masculino',
     'Camiseta oversized Off-White · Coleção Multiplicação',
     'Camiseta oversized da coleção Multiplicação. A estampa traduz o milagre dos pães e peixes: 5 pães + 2 peixes = MULTIPLICAÇÃO. Malha 100% algodão penteado fio 30.1, gola careca reforçada e caimento amplo.',
     49.90, 'Off-White', '#E7E0D0', true),
  ('masculino', 'Camiseta Multiplicação Preta · Masculino',
     'camiseta-multiplicacao-preta-masculino',
     'Camiseta oversized Preta · Coleção Multiplicação',
     'Camiseta oversized da coleção Multiplicação. A estampa traduz o milagre dos pães e peixes: 5 pães + 2 peixes = MULTIPLICAÇÃO. Malha 100% algodão penteado fio 30.1, gola careca reforçada e caimento amplo.',
     49.90, 'Preta', '#161616', false),
  ('infantil',  'Camiseta Multiplicação Off-White · Infantil',
     'camiseta-multiplicacao-off-white-infantil',
     'Camiseta oversized Off-White · Coleção Multiplicação',
     'Camiseta oversized da coleção Multiplicação. A estampa traduz o milagre dos pães e peixes: 5 pães + 2 peixes = MULTIPLICAÇÃO. Malha 100% algodão penteado fio 30.1, gola careca reforçada e caimento amplo.',
     39.90, 'Off-White', '#E7E0D0', false),
  ('infantil',  'Camiseta Multiplicação Preta · Infantil',
     'camiseta-multiplicacao-preta-infantil',
     'Camiseta oversized Preta · Coleção Multiplicação',
     'Camiseta oversized da coleção Multiplicação. A estampa traduz o milagre dos pães e peixes: 5 pães + 2 peixes = MULTIPLICAÇÃO. Malha 100% algodão penteado fio 30.1, gola careca reforçada e caimento amplo.',
     39.90, 'Preta', '#161616', true)
) as v(cat, name, slug, ds, dl, price, color, hex, feat)
join public.categories c on c.slug = v.cat
on conflict (slug) do nothing;

-- Imagens (as fotos vivem em /public/products e são servidas pelo app)
insert into public.product_images (product_id, storage_path, alt_text, position, is_primary)
select p.id, i.path, i.alt, i.pos, i.pos = 0
from public.products p
join lateral (values
  -- Feminino Off-White
  ('camiseta-multiplicacao-off-white-feminino', '/products/frente_mulher_inicial_bege_larga.png', 'Camiseta Off-White feminina, frente', 0),
  ('camiseta-multiplicacao-off-white-feminino', '/products/costas_mulher_inicial_bege.png', 'Camiseta Off-White feminina, costas', 1),
  ('camiseta-multiplicacao-off-white-feminino', '/products/modelo_mulher_camisa_bege.png', 'Modelo feminina com camiseta Off-White', 2),
  ('camiseta-multiplicacao-off-white-feminino', '/products/costas_mulher_negra_bege.png', 'Camiseta Off-White feminina, costas (estampa)', 3),
  -- Feminino Preta
  ('camiseta-multiplicacao-preta-feminino', '/products/frente_mulher_inicial_preto_larga.png', 'Camiseta Preta feminina, frente', 0),
  ('camiseta-multiplicacao-preta-feminino', '/products/costas_mulher_inicial_preto.png', 'Camiseta Preta feminina, costas', 1),
  ('camiseta-multiplicacao-preta-feminino', '/products/modelo_mulher_camisa_preta.png', 'Modelo feminina com camiseta Preta', 2),
  ('camiseta-multiplicacao-preta-feminino', '/products/frente_mulher_negra_preta.png', 'Camiseta Preta feminina, detalhe', 3),
  -- Masculino Off-White
  ('camiseta-multiplicacao-off-white-masculino', '/products/frente_homem_inicial_bege_larga.png', 'Camiseta Off-White masculina, frente', 0),
  ('camiseta-multiplicacao-off-white-masculino', '/products/costas_homem_inicial_bege.png', 'Camiseta Off-White masculina, costas', 1),
  ('camiseta-multiplicacao-off-white-masculino', '/products/modelo_homem_camisa_bege.png', 'Modelo masculino com camiseta Off-White', 2),
  ('camiseta-multiplicacao-off-white-masculino', '/products/modelo_homem_bege_sentado.png', 'Modelo masculino sentado, lifestyle', 3),
  -- Masculino Preta
  ('camiseta-multiplicacao-preta-masculino', '/products/frente_homem_inicial_preto_larga.png', 'Camiseta Preta masculina, frente', 0),
  ('camiseta-multiplicacao-preta-masculino', '/products/costas_homem_inicial_preto.png', 'Camiseta Preta masculina, costas', 1),
  ('camiseta-multiplicacao-preta-masculino', '/products/modelo_homem_camisa_preta.png', 'Modelo masculino com camiseta Preta', 2),
  ('camiseta-multiplicacao-preta-masculino', '/products/frente_homem_inicial_preto_final.png', 'Camiseta Preta masculina, detalhe', 3),
  -- Infantil Off-White
  ('camiseta-multiplicacao-off-white-infantil', '/products/frente_menino_bege_v2.png', 'Criança com camiseta Off-White, frente', 0),
  ('camiseta-multiplicacao-off-white-infantil', '/products/costas_menino_bege_v2.png', 'Camiseta Off-White infantil, costas', 1),
  -- Infantil Preta
  ('camiseta-multiplicacao-preta-infantil', '/products/frente_menina_preta_v2.png', 'Criança com camiseta Preta, frente', 0),
  ('camiseta-multiplicacao-preta-infantil', '/products/costas_menina_preta_v2.png', 'Camiseta Preta infantil, costas', 1)
) as i(slug, path, alt, pos) on i.slug = p.slug;

-- Variantes por tamanho (estoque próprio). Adulto: PP..EXGG · Infantil: 2..10
insert into public.product_variants (product_id, size, stock, position)
select p.id, s.size, s.stock, s.position
from public.products p
join lateral (values
  ('camiseta-multiplicacao-off-white-feminino','PP',4,0),('camiseta-multiplicacao-off-white-feminino','P',8,1),('camiseta-multiplicacao-off-white-feminino','M',10,2),('camiseta-multiplicacao-off-white-feminino','G',7,3),('camiseta-multiplicacao-off-white-feminino','GG',5,4),('camiseta-multiplicacao-off-white-feminino','XGG',2,5),('camiseta-multiplicacao-off-white-feminino','EXGG',0,6),
  ('camiseta-multiplicacao-preta-feminino','PP',6,0),('camiseta-multiplicacao-preta-feminino','P',9,1),('camiseta-multiplicacao-preta-feminino','M',12,2),('camiseta-multiplicacao-preta-feminino','G',8,3),('camiseta-multiplicacao-preta-feminino','GG',4,4),('camiseta-multiplicacao-preta-feminino','XGG',3,5),('camiseta-multiplicacao-preta-feminino','EXGG',1,6),
  ('camiseta-multiplicacao-off-white-masculino','PP',3,0),('camiseta-multiplicacao-off-white-masculino','P',7,1),('camiseta-multiplicacao-off-white-masculino','M',11,2),('camiseta-multiplicacao-off-white-masculino','G',9,3),('camiseta-multiplicacao-off-white-masculino','GG',6,4),('camiseta-multiplicacao-off-white-masculino','XGG',4,5),('camiseta-multiplicacao-off-white-masculino','EXGG',2,6),
  ('camiseta-multiplicacao-preta-masculino','PP',0,0),('camiseta-multiplicacao-preta-masculino','P',6,1),('camiseta-multiplicacao-preta-masculino','M',10,2),('camiseta-multiplicacao-preta-masculino','G',12,3),('camiseta-multiplicacao-preta-masculino','GG',7,4),('camiseta-multiplicacao-preta-masculino','XGG',5,5),('camiseta-multiplicacao-preta-masculino','EXGG',3,6),
  ('camiseta-multiplicacao-off-white-infantil','2',5,0),('camiseta-multiplicacao-off-white-infantil','4',6,1),('camiseta-multiplicacao-off-white-infantil','6',4,2),('camiseta-multiplicacao-off-white-infantil','8',3,3),('camiseta-multiplicacao-off-white-infantil','10',2,4),
  ('camiseta-multiplicacao-preta-infantil','2',6,0),('camiseta-multiplicacao-preta-infantil','4',5,1),('camiseta-multiplicacao-preta-infantil','6',5,2),('camiseta-multiplicacao-preta-infantil','8',4,3),('camiseta-multiplicacao-preta-infantil','10',3,4)
) as s(slug, size, stock, position) on s.slug = p.slug
on conflict (product_id, size) do nothing;

-- Template da mensagem Pix
insert into public.message_templates (key, name, body) values
  ('pix', 'Mensagem Pix',
   E'Olá {{cliente}}! Seu pedido #{{pedido}} foi aceito 🎉\nTotal: {{valor}}\nPix ({{recebedor}}): {{chave_pix}}\nAssim que confirmarmos o pagamento, seguimos com a separação. Obrigado!')
on conflict (key) do nothing;

-- Configurações
insert into public.settings (key, value, is_public) values
  ('pix',   '{"chave":"","recebedor":"Casa de Filadélfia","banco":"","observacao":""}'::jsonb, false),
  ('visual','{"primaryColor":"#161616","logoUrl":"/logo.png","bannerUrl":""}'::jsonb, true),
  ('store', '{"name":"Casa de Filadélfia","whatsapp":""}'::jsonb, true),
  ('pwa',   '{"name":"Casa de Filadélfia","shortName":"Filadélfia"}'::jsonb, true)
on conflict (key) do nothing;

-- ============================================================
-- Para promover um usuário a admin (após ele se cadastrar):
--   update public.profiles set role = 'super_admin'
--   where id = (select id from auth.users where email = 'voce@exemplo.com');
-- ============================================================
