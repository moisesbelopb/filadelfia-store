-- ============================================================
-- 0011 — Editar itens do pedido (admin): excluir, alterar quantidade e
-- trocar o item (tamanho ou produto). Mantém a integridade do estoque e
-- recalcula o total do pedido + status de pagamento (reflete no dashboard).
--
-- "Reservado" = pedido em qualquer status que NÃO seja cancelado/recusado
-- (nesses o estoque já foi devolvido, então editar itens não mexe no estoque).
-- Idempotente (create or replace).
-- ============================================================

-- Recalcula subtotal/total/payment_status do pedido a partir dos itens + pagamentos.
create or replace function public.recompute_order_money(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_subtotal numeric(12,2);
  v_fee numeric(12,2);
  v_total numeric(12,2);
  v_paid numeric(12,2);
begin
  select coalesce(sum(line_total), 0) into v_subtotal
    from public.order_items where order_id = p_order;
  select delivery_fee into v_fee from public.orders where id = p_order;
  v_total := v_subtotal + coalesce(v_fee, 0);
  select coalesce(sum(case when kind = 'estorno' then -amount else amount end), 0) into v_paid
    from public.order_payments where order_id = p_order;
  update public.orders
     set subtotal = v_subtotal,
         total = v_total,
         payment_status = case when v_paid >= v_total then 'pago' else 'pendente' end
   where id = p_order;
end $$;

-- Exclui um item do pedido (devolve o estoque se reservado). Não deixa remover
-- o último item — nesse caso o certo é cancelar o pedido.
create or replace function public.admin_delete_order_item(p_item uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order uuid; v_variant uuid; v_qty int; v_status order_status; v_reserved boolean; v_count int;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado' using errcode = 'insufficient_privilege';
  end if;

  select oi.order_id, oi.variant_id, oi.quantity, o.status
    into v_order, v_variant, v_qty, v_status
    from public.order_items oi join public.orders o on o.id = oi.order_id
   where oi.id = p_item;
  if v_order is null then raise exception 'Item não encontrado'; end if;

  select count(*) into v_count from public.order_items where order_id = v_order;
  if v_count <= 1 then
    raise exception 'O pedido precisa ter ao menos um item. Cancele o pedido em vez de remover o último item.';
  end if;

  v_reserved := v_status not in ('cancelado', 'recusado');
  if v_reserved and v_variant is not null then
    update public.product_variants set stock = stock + v_qty where id = v_variant;
    insert into public.inventory_movements (product_id, type, quantity, order_id, reason, created_by)
      select product_id, 'liberacao', v_qty, v_order, 'Item removido do pedido', auth.uid()
      from public.product_variants where id = v_variant;
  end if;

  delete from public.order_items where id = p_item;
  perform public.recompute_order_money(v_order);
end $$;

-- Altera um item: quantidade e/ou variante (tamanho ou produto). A variante nova
-- pode ser do mesmo produto (troca de tamanho) ou de outro (troca de produto).
-- Ajusta o estoque (devolve o antigo, reserva o novo) exigindo disponibilidade.
create or replace function public.admin_change_order_item(p_item uuid, p_variant uuid, p_qty int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order uuid; v_status order_status; v_reserved boolean;
  v_old_variant uuid; v_old_qty int;
  v_new_product uuid; v_new_size text; v_new_price numeric(12,2); v_new_name text; v_avail int;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado' using errcode = 'insufficient_privilege';
  end if;
  if p_qty < 1 or p_qty > 99 then raise exception 'Quantidade inválida (1 a 99).'; end if;

  select oi.order_id, oi.variant_id, oi.quantity, o.status
    into v_order, v_old_variant, v_old_qty, v_status
    from public.order_items oi join public.orders o on o.id = oi.order_id
   where oi.id = p_item;
  if v_order is null then raise exception 'Item não encontrado'; end if;
  v_reserved := v_status not in ('cancelado', 'recusado');

  select v.product_id, v.size, p.price, p.name
    into v_new_product, v_new_size, v_new_price, v_new_name
    from public.product_variants v join public.products p on p.id = v.product_id
   where v.id = p_variant;
  if v_new_product is null then raise exception 'Produto/tamanho não encontrado'; end if;

  if v_reserved then
    -- devolve o estoque do item antigo
    if v_old_variant is not null then
      update public.product_variants set stock = stock + v_old_qty where id = v_old_variant;
      insert into public.inventory_movements (product_id, type, quantity, order_id, reason, created_by)
        select product_id, 'liberacao', v_old_qty, v_order, 'Edição de item', auth.uid()
        from public.product_variants where id = v_old_variant;
    end if;
    -- reserva a variante nova (checa disponibilidade já com a devolução acima aplicada)
    select stock into v_avail from public.product_variants where id = p_variant for update;
    if v_avail < p_qty then
      raise exception 'Estoque insuficiente para % (tam. %): disponível %, necessário %',
        v_new_name, v_new_size, v_avail, p_qty using errcode = 'check_violation';
    end if;
    update public.product_variants set stock = stock - p_qty where id = p_variant;
    insert into public.inventory_movements (product_id, type, quantity, order_id, reason, created_by)
      values (v_new_product, 'reserva', p_qty, v_order, 'Edição de item', auth.uid());
  end if;

  update public.order_items
     set variant_id = p_variant,
         product_id = v_new_product,
         product_name = v_new_name,
         variant_size = v_new_size,
         unit_price = v_new_price,
         quantity = p_qty,
         line_total = v_new_price * p_qty
   where id = p_item;

  perform public.recompute_order_money(v_order);
end $$;

revoke all on function public.admin_delete_order_item(uuid) from public;
revoke all on function public.admin_change_order_item(uuid, uuid, int) from public;
grant execute on function public.admin_delete_order_item(uuid) to authenticated;
grant execute on function public.admin_change_order_item(uuid, uuid, int) to authenticated;
