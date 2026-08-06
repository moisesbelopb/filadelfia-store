-- ============================================================
-- 0009 — Edição/correção manual do status do pedido (admin)
-- Permite ao admin FORÇAR qualquer status (fora da ordem normal) via a RPC
-- admin_set_order_status, mantendo a integridade do estoque:
--   • reservado -> liberado (cancelar/recusar): devolve o estoque
--   • liberado  -> reservado (reabrir):          re-reserva; FALHA se faltar
-- A trava order_transition_allowed continua valendo para o fluxo normal; só a
-- RPC (com is_admin) a ignora, por uma flag de transação: app.status_override.
-- Idempotente: pode rodar por cima do estado atual (create or replace).
-- ============================================================

-- ---------- FSM: honra a flag de override (o fluxo normal segue travado) ----------
create or replace function public.enforce_order_transition()
returns trigger language plpgsql as $$
declare
  v_override boolean := coalesce(current_setting('app.status_override', true), 'off') = 'on';
begin
  if new.status is distinct from old.status then
    if not v_override and not public.order_transition_allowed(old.status, new.status) then
      raise exception 'Transição inválida: % -> %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    -- Motivo obrigatório em recusa/cancelamento (vale também no override).
    if new.status in ('recusado','cancelado')
       and coalesce(nullif(trim(new.status_reason), ''), '') = '' then
      raise exception 'Informe o motivo para % o pedido', new.status
        using errcode = 'check_violation';
    end if;

    -- Timestamps de negócio + correção ao voltar atrás.
    if new.status = 'aceito'   and new.accepted_at  is null then new.accepted_at  := now(); end if;
    if new.status = 'entregue' and new.delivered_at is null then new.delivered_at := now(); end if;
    if new.status = 'solicitado' then new.accepted_at  := null; end if;
    if new.status <> 'entregue'  then new.delivered_at := null; end if;
  end if;
  return new;
end $$;

-- ---------- Estoque: modelo reservado/liberado (idempotente + re-reserva) ----------
create or replace function public.apply_inventory_on_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_was_released boolean := old.status in ('recusado','cancelado');
  v_now_released boolean := new.status in ('recusado','cancelado');
begin
  if new.status is distinct from old.status then
    -- reservado -> liberado: devolve o estoque das variantes
    if v_now_released and not v_was_released then
      for r in
        select product_id, variant_id, quantity from public.order_items
        where order_id = new.id and variant_id is not null
      loop
        update public.product_variants set stock = stock + r.quantity where id = r.variant_id;
        insert into public.inventory_movements (product_id, type, quantity, order_id, reason, created_by)
        values (r.product_id, 'liberacao', r.quantity, new.id, 'Liberação por ' || new.status, auth.uid());
      end loop;

    -- liberado -> reservado (reabertura): re-reserva; EXIGE estoque
    elsif v_was_released and not v_now_released then
      for r in
        select oi.product_id, oi.variant_id, oi.quantity, oi.variant_size, p.name, v.stock
        from public.order_items oi
        join public.product_variants v on v.id = oi.variant_id
        join public.products p on p.id = oi.product_id
        where oi.order_id = new.id and oi.variant_id is not null
        for update of v
      loop
        if r.stock < r.quantity then
          raise exception 'Estoque insuficiente para % (tam. %): disponível %, necessário %',
            r.name, r.variant_size, r.stock, r.quantity using errcode = 'check_violation';
        end if;
        update public.product_variants set stock = stock - r.quantity where id = r.variant_id;
        insert into public.inventory_movements (product_id, type, quantity, order_id, reason, created_by)
        values (r.product_id, 'reserva', r.quantity, new.id, 'Reabertura de pedido', auth.uid());
      end loop;
    end if;

    -- Baixa por entrega (só registro; não altera estoque).
    if new.status = 'entregue' and old.status <> 'entregue' then
      for r in
        select product_id, quantity from public.order_items
        where order_id = new.id and product_id is not null
      loop
        insert into public.inventory_movements (product_id, type, quantity, order_id, reason, created_by)
        values (r.product_id, 'baixa', r.quantity, new.id, 'Baixa por entrega', auth.uid());
      end loop;
    end if;
  end if;
  return new;
end $$;

-- ---------- RPC: admin força o status (ignora a ordem normal do fluxo) ----------
create or replace function public.admin_set_order_status(
  p_order uuid, p_new order_status, p_reason text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado' using errcode = 'insufficient_privilege';
  end if;
  -- Libera o override só NESTA transação (fluxo normal continua travado).
  perform set_config('app.status_override', 'on', true);
  update public.orders
     set status = p_new,
         status_reason = case when p_new in ('recusado','cancelado')
                              then nullif(trim(coalesce(p_reason, '')), '')
                              else null end
   where id = p_order;
  if not found then
    raise exception 'Pedido não encontrado';
  end if;
end $$;

revoke all on function public.admin_set_order_status(uuid, order_status, text) from public;
grant execute on function public.admin_set_order_status(uuid, order_status, text) to authenticated;
