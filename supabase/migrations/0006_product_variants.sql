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
