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
