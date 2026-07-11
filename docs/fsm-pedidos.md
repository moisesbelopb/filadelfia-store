# FSM do Pedido — Casa de Filadélfia

Máquina de estados do pedido estilo *delivery*. Fonte: seção 8 do plano.
Regra central: **o cliente solicita, o admin conduz**. O cliente nunca altera
status (exceto, se habilitado, um cancelamento controlado via Server Action).

---

## 1. Estados

| Status | Quem altera | Mensagem ao cliente |
|---|---|---|
| `solicitado` | Sistema | Recebemos sua solicitação. Aguarde a confirmação da equipe. |
| `aceito` | Admin | Pedido aceito pela Casa de Filadélfia. |
| `em_separacao` | Admin | Estamos separando/preparando seu pedido. |
| `saiu_entrega` | Admin | Seu pedido saiu para entrega. |
| `entregue` | Admin | Pedido entregue. Obrigado! |
| `recusado` | Admin | Pedido não aceito. Exibir motivo informado. |
| `cancelado` | Admin | Pedido cancelado. Exibir motivo informado. |

Estados finais: `entregue`, `recusado`, `cancelado`.

---

## 2. Transições permitidas

```
solicitado   → aceito | recusado | cancelado
aceito       → em_separacao | cancelado
em_separacao → saiu_entrega | cancelado
saiu_entrega → entregue | cancelado
entregue     → (final)
recusado     → (final)
cancelado    → (final)
```

Diagrama:

```
                ┌─────────────┐
                │  solicitado │
                └──────┬──────┘
        ┌──────────────┼───────────────┐
        ▼              ▼                ▼
    ┌────────┐   ┌──────────┐     ┌──────────┐
    │recusado│   │  aceito  │     │cancelado │
    └────────┘   └────┬─────┘     └──────────┘
       (final)        ▼                 ▲
                ┌──────────────┐        │
                │ em_separacao │────────┤ (cancelado
                └──────┬───────┘        │  permitido em
                       ▼                │  qualquer etapa
                ┌──────────────┐        │  ativa)
                │ saiu_entrega │────────┤
                └──────┬───────┘        │
                       ▼                │
                ┌──────────────┐        │
                │   entregue   │  (final)
                └──────────────┘
```

**Regras de negócio acopladas às transições (efeitos colaterais):**
- `solicitado`: reserva de estoque (`inventory_movements` type `reserva`) — Fase 5.
- `→ aceito`: grava `accepted_at`; se `payment_method = 'pix'`, dispara a
  mensagem Pix via Evolution (Fase 7). Estoque permanece reservado.
- `→ recusado` / `→ cancelado`: libera estoque (`liberacao`) — Fase 8; exige `reason`.
- `→ entregue`: baixa de estoque (`baixa`); grava `delivered_at` — Fase 8.
- Toda transição gera linha em `order_status_history`.

---

## 3. Implementação em duas camadas

Defesa em profundidade: a **verdade** é o trigger no banco; a checagem no
servidor apenas melhora a UX (mensagens amigáveis) antes de chamar o banco.

### 3.1 Camada 1 — Banco (fonte da verdade)

Trigger `BEFORE UPDATE` em `orders` que valida a transição e um trigger
`AFTER UPDATE` que registra o histórico. Migration da Fase 6.

```sql
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

-- Valida a transição antes de gravar.
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

create trigger trg_log_order_status
  after update on public.orders
  for each row execute function public.log_order_status();
```

### 3.2 Camada 2 — Servidor (espelho em TypeScript)

`lib/orders/fsm.ts` — usado por Server Actions do admin para checar antes de
chamar o banco e para renderizar botões válidos na UI.

```ts
export const ORDER_STATUS = [
  'solicitado','aceito','em_separacao','saiu_entrega','entregue',
  'recusado','cancelado',
] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  solicitado:   ['aceito', 'recusado', 'cancelado'],
  aceito:       ['em_separacao', 'cancelado'],
  em_separacao: ['saiu_entrega', 'cancelado'],
  saiu_entrega: ['entregue', 'cancelado'],
  entregue:     [],
  recusado:     [],
  cancelado:    [],
};

export const REASON_REQUIRED: OrderStatus[] = ['recusado', 'cancelado'];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from];
}
```

> Manter `TRANSITIONS` (TS) e `order_transition_allowed` (SQL) **sincronizados**.
> O SQL é a autoridade; o TS é conveniência de UX.

---

## 4. Realtime

O cliente assina mudanças da própria linha em `orders` (e/ou
`order_status_history`) via Supabase Realtime para atualizar a timeline sem
recarregar (Fase 6). RLS já garante que só recebe eventos dos próprios pedidos.
