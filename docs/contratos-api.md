# Contratos de API — Casa de Filadélfia

Como o front (Next.js App Router) conversa com o backend (Supabase) e com a
Evolution API. Padrão: **Server Actions** para mutações vindas da UI e
**Route Handlers** (`app/api/...`) para integrações e webhooks. Nenhuma chave
sensível trafega no client.

---

## 1. Convenções

- **Validação:** todo input é validado com **Zod** no servidor antes de tocar o banco.
- **Retorno padrão de Server Action:**
  ```ts
  type ActionResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
  ```
- **Autorização:** ações do admin verificam `is_admin()` no servidor (não confiar na UI).
- **Auditoria:** ações críticas gravam `audit_logs`; envios WhatsApp gravam `notification_logs`.
- **Cliente Supabase:** `lib/supabase/server.ts` (cookies/SSR) para o contexto do usuário;
  `service_role` só em rotas server que precisam ignorar RLS (logs, envio Evolution).
- **Idempotência de dinheiro:** subtotal/total recalculados **no servidor** a partir
  dos preços atuais dos produtos — nunca confiar em valores vindos do client.

---

## 2. Schemas Zod (núcleo)

`lib/validators/` — schemas compartilhados.

```ts
// address
export const addressSchema = z.object({
  street: z.string().min(2),
  number: z.string().min(1),
  complement: z.string().optional(),
  neighborhood: z.string().min(2),
  city: z.string().min(2),
  state: z.string().length(2),
  zip: z.string().min(8).max(9),
});

// checkout (criação de pedido)
export const checkoutSchema = z.object({
  customerName: z.string().min(2),
  customerWhatsapp: z.string().min(10),      // com DDD
  address: addressSchema,
  notes: z.string().max(500).optional(),
  paymentMethod: z.enum(['pix', 'dinheiro', 'cartao']),
  // itens vêm do carrinho do usuário no servidor; não do payload.
});

// produto (admin)
export const productSchema = z.object({
  name: z.string().min(2),
  categoryId: z.string().uuid().nullable(),
  descriptionShort: z.string().max(160).optional(),
  descriptionLong: z.string().optional(),
  price: z.coerce.number().nonnegative(),
  stock: z.coerce.number().int().nonnegative(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

// mudança de status (admin)
export const orderStatusSchema = z.object({
  orderId: z.string().uuid(),
  to: z.enum(['aceito','em_separacao','saiu_entrega','entregue','recusado','cancelado']),
  reason: z.string().optional(),   // obrigatório em recusado/cancelado (checado no server)
});
```

---

## 3. Server Actions por domínio

### 3.1 Cliente — carrinho
`actions/cart.ts`
| Ação | Assinatura | Regra |
|---|---|---|
| `addToCart` | `(productId, qty) → ActionResult<CartItem>` | valida produto ativo e estoque; upsert em `cart_items` |
| `updateCartItem` | `(itemId, qty) → ActionResult` | qty>0; revalida estoque |
| `removeCartItem` | `(itemId) → ActionResult` | dono via RLS |
| `mergeGuestCart` | `(items[]) → ActionResult` | funde carrinho local (Zustand) ao logar |

### 3.2 Cliente — checkout / pedido
`actions/orders.ts`
| Ação | Assinatura | Regra |
|---|---|---|
| `createOrder` | `(checkoutSchema) → ActionResult<{orderId, orderNumber}>` | **transação:** revalida estoque de cada item → cria `orders` (`solicitado`) → `order_items` (snapshot nome/preço) → recalcula totais → **reserva** estoque (`inventory_movements`) → limpa carrinho |
| `getMyOrders` | `() → Order[]` | RLS: só os próprios |
| `getOrder` | `(id) → OrderDetail` | RLS |
| `cancelMyOrder` | `(id, reason) → ActionResult` | **opcional**; só se `status='solicitado'`; passa pela FSM |

> `createOrder` deve rodar como transação (RPC Postgres/`rpc` ou função server)
> para garantir atomicidade entre pedido, itens e reserva de estoque.

### 3.3 Admin — pedidos
`actions/admin/orders.ts`
| Ação | Assinatura | Regra |
|---|---|---|
| `changeOrderStatus` | `(orderStatusSchema) → ActionResult` | checa `is_admin()` + `canTransition()` (TS) antes; o trigger é a autoridade; `reason` obrigatório em recusado/cancelado; se `→aceito` e Pix → enfileira envio; grava `audit_logs` |
| `markPaid` | `(orderId) → ActionResult` | `payment_status='pago'`; auditoria |
| `listOrders` | `(filtros) → Order[]` | filtros por status/cliente/período |

### 3.4 Admin — produtos e estoque
`actions/admin/products.ts`, `actions/admin/inventory.ts`
| Ação | Regra |
|---|---|
| `createProduct` / `updateProduct` | `productSchema`; slug único; auditoria |
| `uploadProductImage` | valida `image/*`, tamanho máx; grava em Storage + `product_images`; 1 `is_primary` |
| `toggleProductActive` | ativa/inativa |
| `adjustStock` | cria `inventory_movements` (`ajuste`/`entrada`); recalcula `products.stock` |

### 3.5 Admin — configurações
`actions/admin/settings.ts`
| Ação | Regra |
|---|---|
| `savePixSettings` | grava `settings['pix']` (chave, recebedor, banco, obs) |
| `saveMessageTemplate` | upsert em `message_templates` por `key` |
| `saveEvolutionConfig` | grava `settings['evolution']` **não-secreto** (base_url, instance); a API key fica em env |
| `saveVisualSettings` | `settings['visual']` público (cores, logo, banner) |

---

## 4. Route Handlers (`app/api/...`)

| Rota | Método | Uso |
|---|---|---|
| `/api/auth/callback` | GET | callback OAuth (Google) do Supabase |
| `/api/admin/notifications/send-pix` | POST | dispara mensagem Pix via Evolution (server-only); grava log |
| `/api/admin/notifications/test` | POST | teste de envio no painel de config |
| `/api/webhooks/evolution` | POST | (futuro) status de entrega da mensagem |

> Alternativamente, o envio Pix pode ser uma Server Action interna chamada por
> `changeOrderStatus`. O Route Handler é útil para reenvio manual e teste.

---

## 5. Contrato Evolution API (envio de texto)

**Verificado na fonte citada no plano** (`docs.evolutionfoundation.com.br`, v2.3.7):

- **Método/URL:** `POST {EVOLUTION_API_BASE_URL}/message/sendText/{EVOLUTION_API_INSTANCE}`
- **Header:** `apikey: {EVOLUTION_API_KEY}` (+ `Content-Type: application/json`)
- **Body:**
  ```json
  {
    "number": "5599999999999",
    "textMessage": { "text": "sua mensagem" }
  }
  ```
  Opcionais: `delay`, `quoted`, `linkPreview`, `mentioned`.

> ⚠️ **Confirmar na Fase 7 contra a instância real.** Distribuições diferentes do
> Evolution divergem no corpo: a mainline v2 usa `{ "number", "text" }` (plano),
> enquanto o fork citado usa `{ "number", "textMessage": { "text" } }`. O cliente
> em `lib/evolution/client.ts` deve isolar esse formato num único ponto.

**Cliente server-only** (`lib/evolution/client.ts`, com `import 'server-only'`):
```ts
export async function sendWhatsappText(to: string, text: string) {
  const base = process.env.EVOLUTION_API_BASE_URL!;
  const instance = process.env.EVOLUTION_API_INSTANCE!;
  const res = await fetch(`${base}/message/sendText/${instance}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_API_KEY! },
    body: JSON.stringify({ number: normalizePhone(to), textMessage: { text } }),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}
```

**Fluxo Pix (após aceite):**
1. Admin aceita pedido Pix → `changeOrderStatus(to: 'aceito')`.
2. Server renderiza `message_templates['pix']` com variáveis.
3. `sendWhatsappText(customerWhatsapp, mensagem)`.
4. Grava `notification_logs` (request/response/status).
5. Em erro: status `erro` no log, exibir no admin, permitir **reenvio manual** (auditado).

---

## 6. Template de mensagem — variáveis

`message_templates.body` aceita placeholders substituídos no servidor:

| Variável | Fonte |
|---|---|
| `{{cliente}}` | `orders.customer_name` |
| `{{pedido}}` | `orders.order_number` |
| `{{valor}}` | `orders.total` (formatado BRL) |
| `{{chave_pix}}` | `settings['pix'].chave` |
| `{{recebedor}}` | `settings['pix'].recebedor` |
| `{{itens}}` | lista de `order_items` |

Exemplo (`key = 'pix'`):
```
Olá {{cliente}}! Seu pedido #{{pedido}} foi aceito 🎉
Total: {{valor}}
Pix ({{recebedor}}): {{chave_pix}}
Assim que confirmarmos o pagamento, seguimos com a separação. Obrigado!
```

---

## 7. Segurança das rotas (resumo)

- Middleware (`middleware.ts`) renova sessão Supabase e protege `/admin/*` e áreas do cliente.
- Server Actions do admin revalidam `is_admin()` (defesa além do middleware).
- `service_role` e `EVOLUTION_API_KEY` só em código server; nunca em componentes client.
- Uploads validam mime/tamanho antes de gravar no Storage.
