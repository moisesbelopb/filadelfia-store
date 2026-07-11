-- ============================================================
-- Grupo de cor explícito no produto.
-- Antes: a loja agrupava as cores por CATEGORIA (frágil se houver peças
-- diferentes na mesma categoria). Agora, produtos com o mesmo `color_group`
-- são variações de cor do MESMO item (cada um com suas fotos/tamanhos).
-- Se `color_group` for nulo, a loja cai no comportamento antigo (categoria).
-- Aplicar DEPOIS de 0006_product_variants.sql.
-- ============================================================

alter table public.products
  add column if not exists color_group text;

create index if not exists idx_products_color_group
  on public.products(color_group)
  where color_group is not null;
