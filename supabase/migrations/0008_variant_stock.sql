-- ============================================================
-- Baixa de estoque POR VARIANTE (tamanho) — corrige risco de vender a mais.
-- Antes: create_order validava/baixava o agregado products.stock (dava pra
-- vender o mesmo "M" duas vezes). Agora valida e reserva em product_variants
-- (por tamanho), travando a linha da variante contra concorrência.
-- products.stock continua sendo a soma das variantes (trigger sync_product_stock).
-- Aplicar DEPOIS de 0006_product_variants.sql e 0007_delivery.sql.
-- ============================================================

-- order_items: guarda a variante (permite liberar o estoque certo no cancelamento).
-- variant_size (snapshot do tamanho) já existe desde 0006.
alter table public.order_items
  add column if not exists variant_id uuid references public.product_variants(id) on delete set null;

-- ---------- create_order: reserva por variante (mesma assinatura da 0007) ----------
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
  if p_fulfillment_type = 'retirada' then
    v_fee := 0;
  elsif v_fee < 0 then
    v_fee := 0;
  end if;

  select id into v_cart_id from public.carts where user_id = v_uid;
  if v_cart_id is null then
    raise exception 'Carrinho vazio';
  end if;

  -- Todo item precisa de um tamanho (variante) escolhido.
  if exists (select 1 from public.cart_items where cart_id = v_cart_id and variant_id is null) then
    raise exception 'Selecione o tamanho de todos os itens';
  end if;

  -- Valida estoque POR VARIANTE e trava a linha da variante (anti-concorrência).
  for r in
    select ci.quantity, v.id as variant_id, v.size, v.stock, v.product_id,
           p.name, p.price, p.is_active
    from public.cart_items ci
    join public.product_variants v on v.id = ci.variant_id
    join public.products p on p.id = v.product_id
    where ci.cart_id = v_cart_id
    for update of v
  loop
    if not r.is_active then
      raise exception 'Produto indisponível: %', r.name;
    end if;
    if r.stock < r.quantity then
      raise exception 'Estoque insuficiente para % (tam. %): disponível %', r.name, r.size, r.stock;
    end if;
    v_subtotal := v_subtotal + (r.price * r.quantity);
  end loop;

  if v_subtotal = 0 then
    raise exception 'Carrinho vazio';
  end if;

  insert into public.orders (
    user_id, status, customer_name, customer_whatsapp, address, notes,
    payment_method, fulfillment_type, scheduled_date, scheduled_window,
    subtotal, delivery_fee, total
  ) values (
    v_uid, 'solicitado', p_customer_name, p_customer_whatsapp, p_address, p_notes,
    p_payment_method, p_fulfillment_type, p_scheduled_date, p_scheduled_window,
    v_subtotal, v_fee, v_subtotal + v_fee
  ) returning id, orders.order_number into v_order_id, v_order_number;

  -- Itens (snapshot com tamanho) + baixa por variante.
  for r in
    select ci.quantity, v.id as variant_id, v.size, v.product_id, p.name, p.price
    from public.cart_items ci
    join public.product_variants v on v.id = ci.variant_id
    join public.products p on p.id = v.product_id
    where ci.cart_id = v_cart_id
  loop
    insert into public.order_items
      (order_id, product_id, variant_id, variant_size, product_name, unit_price, quantity, line_total)
    values (v_order_id, r.product_id, r.variant_id, r.size, r.name, r.price, r.quantity,
            r.price * r.quantity);

    -- Baixa na variante; o trigger sync_product_stock recalcula products.stock.
    update public.product_variants set stock = stock - r.quantity where id = r.variant_id;

    insert into public.inventory_movements
      (product_id, type, quantity, order_id, reason, created_by)
    values (r.product_id, 'reserva', r.quantity, v_order_id,
            'Reserva por pedido (tam. ' || r.size || ')', v_uid);
  end loop;

  delete from public.cart_items where cart_id = v_cart_id;

  return query select v_order_id, v_order_number;
end $$;

grant execute on function
  public.create_order(text, text, jsonb, text, payment_method, text, date, text, numeric)
  to authenticated;

-- ---------- Liberação por variante no cancelamento/recusa ----------
create or replace function public.apply_inventory_on_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status is distinct from old.status then
    if new.status in ('recusado', 'cancelado') then
      for r in
        select product_id, variant_id, quantity from public.order_items
        where order_id = new.id and variant_id is not null
      loop
        update public.product_variants set stock = stock + r.quantity where id = r.variant_id;
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

-- O trigger trg_apply_inventory_on_status (0004) continua válido: aponta para
-- a função pelo nome e passa a usar esta versão por variante.
