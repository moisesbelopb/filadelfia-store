-- ============================================================
-- FASE 6 — Máquina de estados do pedido (FSM)
-- Autoridade da transição fica no banco. Ver docs/fsm-pedidos.md.
-- ============================================================

-- Mapa de transições válidas.
create or replace function public.order_transition_allowed(
  from_s order_status, to_s order_status
) returns boolean language sql immutable as $$
  select case from_s
    when 'solicitado'   then to_s in ('aceito','recusado','cancelado')
    when 'aceito'       then to_s in ('em_separacao','cancelado')
    when 'em_separacao' then to_s in ('saiu_entrega','cancelado')
    when 'saiu_entrega' then to_s in ('entregue','cancelado')
    else false  -- entregue / recusado / cancelado são finais
  end;
$$;

-- Valida a transição e regras antes de gravar.
create or replace function public.enforce_order_transition()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if not public.order_transition_allowed(old.status, new.status) then
      raise exception 'Transição inválida: % -> %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    -- Motivo obrigatório em recusa/cancelamento.
    if new.status in ('recusado','cancelado')
       and coalesce(nullif(trim(new.status_reason), ''), '') = '' then
      raise exception 'Informe o motivo para % o pedido', new.status
        using errcode = 'check_violation';
    end if;

    -- Timestamps de negócio.
    if new.status = 'aceito'   and new.accepted_at  is null then new.accepted_at  := now(); end if;
    if new.status = 'entregue' and new.delivered_at is null then new.delivered_at := now(); end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_order_transition on public.orders;
create trigger trg_enforce_order_transition
  before update on public.orders
  for each row execute function public.enforce_order_transition();

-- Registra histórico após a mudança de status.
create or replace function public.log_order_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.order_status_history
      (order_id, from_status, to_status, changed_by, reason)
    values (new.id, old.status, new.status, auth.uid(), new.status_reason);
  end if;
  return new;
end $$;

drop trigger if exists trg_log_order_status on public.orders;
create trigger trg_log_order_status
  after update on public.orders
  for each row execute function public.log_order_status();

-- Histórico inicial ao criar o pedido (status 'solicitado').
create or replace function public.log_order_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (new.id, null, new.status, new.user_id);
  return new;
end $$;

drop trigger if exists trg_log_order_created on public.orders;
create trigger trg_log_order_created
  after insert on public.orders
  for each row execute function public.log_order_created();
