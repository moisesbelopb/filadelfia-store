-- Pagamentos parciais/total por pedido. Um pedido pode ter vários pagamentos
-- (sinal + saldo), cada um com sua forma. "Recebido" = soma; "A receber" = saldo.
create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('pix', 'dinheiro', 'cartao')),
  card_brand text check (card_brand in ('visa', 'master', 'outros')),
  card_installments smallint check (card_installments between 1 and 6),
  created_at timestamptz not null default now()
);
create index if not exists idx_order_payments_order on public.order_payments(order_id);

alter table public.order_payments enable row level security;
drop policy if exists "order_payments: admin gerencia" on public.order_payments;
create policy "order_payments: admin gerencia"
  on public.order_payments for all
  using (public.is_admin()) with check (public.is_admin());

-- Backfill: pedidos já pagos viram 1 pagamento cheio (para o dashboard bater).
-- Idempotente: não duplica se rodar de novo.
insert into public.order_payments (order_id, amount, method, card_brand, card_installments)
select o.id, o.total, o.payment_method, o.card_brand, o.card_installments
from public.orders o
where o.payment_status = 'pago'
  and o.total > 0
  and not exists (select 1 from public.order_payments p where p.order_id = o.id);
