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
