-- Preço de custo do produto (base para cálculo de margem/lucro).
-- Opcional (nulo permitido); NUNCA exposto na loja — só no painel admin.
alter table public.products
  add column if not exists cost_price numeric(12,2) check (cost_price >= 0);
