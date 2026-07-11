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
