-- ============================================================
-- 0010 — Pendência por item + estorno de pagamento
-- • order_items.pending_note: observação de pendência do item (ex.: item em
--   falta, cliente aguardando reposição). Visível ao cliente e ao admin.
-- • order_payments.kind: 'pagamento' (padrão) ou 'estorno'. Estorno é um valor
--   POSITIVO que SUBTRAI do recebido (dashboard e status do pedido).
-- • order_payments.note: motivo do estorno (opcional).
-- Idempotente (add column if not exists) — seguro rodar por cima do atual.
-- ============================================================

alter table public.order_items
  add column if not exists pending_note text;

alter table public.order_payments
  add column if not exists kind text not null default 'pagamento'
    check (kind in ('pagamento', 'estorno'));

alter table public.order_payments
  add column if not exists note text;
