# Casa de Filadélfia — Plano de Execução

> Documento mestre de execução do e-commerce **Casa de Filadélfia**.
> Base: `Plano_Ecommerce_Casa_de_Filadelfia_Web_Mobile_PWA.docx`.
> Modelo: web responsivo **mobile-first + PWA opcional**, estilo *delivery*
> (o cliente **solicita**, o admin **aceita**). Sem app nativo no MVP.

**Documentos deste pacote**
| Arquivo | Conteúdo |
|---|---|
| `PLANO-EXECUCAO.md` (este) | Visão geral, stack, estrutura de pastas, roadmap das 10 fases, env vars, riscos |
| `schema.sql` | DDL completo das 14 tabelas, tipos, índices e triggers |
| `rls.sql` | Row Level Security + funções auxiliares |
| `fsm-pedidos.md` | Máquina de estados do pedido + implementação (trigger + guarda server-side) |
| `contratos-api.md` | Server Actions, Route Handlers, validação Zod e contrato da Evolution API |

---

## 1. Princípios de projeto

1. **Mobile-first de verdade** — o celular é a referência; desktop é progressivo.
2. **Delivery, não compra automática** — pedido nasce `solicitado`; admin precisa aceitar.
3. **Pagamento sempre na entrega** — Pix/dinheiro/cartão na entrega. Chave Pix só sai **após aceite**.
4. **Segredos só no servidor** — `service_role` do Supabase e API key da Evolution nunca chegam ao browser.
5. **RLS por padrão** — toda tabela exposta tem política; cliente só enxerga o que é dele.
6. **Snapshots imutáveis** — `order_items` guarda nome/preço no momento do pedido.
7. **Auditoria** — ações críticas do admin geram `audit_logs`; envios de WhatsApp geram `notification_logs`.

---

## 2. Stack

| Camada | Escolha | Observação |
|---|---|---|
| Framework | **Next.js 15 (App Router) + React 19** | Server Components, Server Actions, streaming |
| Linguagem | **TypeScript** (strict) | Tipos do banco gerados via Supabase CLI |
| Estilo | **Tailwind CSS v4** (CSS-first) | Design tokens em `@theme` |
| UI | **shadcn/ui** + componentes próprios | Base acessível, mobile-first |
| Validação | **Zod** | Schemas compartilhados client/server |
| Formulários | **React Hook Form** | Checkout e formulários do admin |
| Estado local | **Zustand** | Carrinho (guest) e estado de UI |
| Dados servidor | **Supabase Realtime** + **TanStack Query** onde couber | Timeline em tempo real |
| Backend | **Supabase** | Postgres, Auth, Storage, Realtime, RLS, Edge Functions |
| Auth | Supabase Auth (e-mail/senha + **Google OAuth**) | `@supabase/ssr` com cookies |
| WhatsApp/Pix | **Evolution API** (server-side) | Route Handler/Server Action; nunca no client |
| Deploy | **Vercel** + domínio **Registro.br** | SSL + Auth URLs |
| Gerenciador | **pnpm** | |
| Qualidade | Biome (lint/format) + TypeScript strict | |

> Versões exatas serão fixadas no scaffold (Fase 1). Antes de fixar APIs de
> libs, consultar a doc oficial (protocolo anti-alucinação).

---

## 3. Estrutura de pastas (alvo)

```
filadelfia-store/
├─ app/
│  ├─ (loja)/                      # experiência do cliente
│  │  ├─ page.tsx                  # Home / catálogo
│  │  ├─ produtos/[slug]/page.tsx  # detalhe do produto
│  │  ├─ carrinho/page.tsx
│  │  ├─ checkout/page.tsx
│  │  ├─ pedidos/page.tsx          # meus pedidos
│  │  ├─ pedidos/[id]/page.tsx     # detalhe + timeline realtime
│  │  └─ conta/page.tsx
│  ├─ (auth)/login | cadastro | callback/
│  ├─ admin/
│  │  ├─ page.tsx                          # dashboard
│  │  ├─ pedidos/page.tsx · [id]/page.tsx
│  │  ├─ produtos/page.tsx · novo/ · [id]/
│  │  ├─ estoque/page.tsx
│  │  └─ configuracoes/{pix,whatsapp,visual}/page.tsx
│  ├─ privacidade/page.tsx         # política pública (LGPD)
│  ├─ api/                         # Route Handlers (Evolution, webhooks futuros)
│  ├─ manifest.ts                  # PWA manifest (file convention)
│  ├─ layout.tsx · globals.css
├─ components/{ui, loja, admin, shared}/
├─ lib/
│  ├─ supabase/{client,server,middleware}.ts
│  ├─ evolution/client.ts          # 'server-only'
│  ├─ validators/                  # schemas Zod por domínio
│  ├─ orders/fsm.ts                # transições permitidas (espelho do trigger)
│  └─ utils.ts
├─ actions/                        # Server Actions por domínio
├─ stores/                         # Zustand
├─ types/database.ts               # gerado do Supabase
├─ supabase/
│  ├─ migrations/                  # SQL versionado (schema.sql → migrations)
│  └─ seed.sql
├─ public/{icons, offline.html}
├─ middleware.ts                   # sessão Supabase + proteção de rotas
├─ .env.local (gitignore) · .env.example
└─ next.config.ts · biome.json · tsconfig.json
```

---

## 4. Roadmap por fase

Cada fase tem **entregas**, **dependências** e **critério de pronto (DoD)**.
Ordem segue o plano; itens do backlog "melhoria/futuro" ficam fora do MVP.

### Fase 1 — Base técnica
- **Entregas:** scaffold Next.js 15 + TS + Tailwind v4 + shadcn + Biome; `pnpm`; clientes Supabase (`client/server/middleware`); `.env.example`; `middleware.ts` de sessão; deploy inicial na Vercel; projeto Supabase criado.
- **Deps:** nenhuma.
- **DoD:** app sobe local e na Vercel; conecta no Supabase; lint/typecheck limpos.

### Fase 2 — Auth e permissões
- **Entregas:** login/cadastro (e-mail+senha e Google), tabela `profiles` com `role`, trigger `handle_new_user`, rotas protegidas (loja/cliente vs `/admin`), RLS inicial (`schema.sql` + `rls.sql`), função `is_admin()`.
- **Deps:** 1.
- **DoD:** cliente e admin acessam apenas suas áreas; RLS bloqueia acesso indevido; tentativa direta ao `/admin` sem role é barrada.

### Fase 3 — Design system mobile-first
- **Entregas:** tokens (cor/tipografia/spacing/radius/elevation/motion) em `@theme`; componentes base (Button, Input, Card, Chip, Sheet, Toast, EmptyState, Skeleton); estados loading/erro; layout responsivo (header com busca+carrinho, menu inferior opcional); `prefers-reduced-motion`.
- **Deps:** 1.
- **DoD:** componentes validados em Android/iPhone/tablet/desktop; contraste e área de toque adequados.

### Fase 4 — Catálogo e produtos
- **Entregas:** tabelas `categories`, `products`, `product_images` + bucket Storage; CRUD admin de produto (fotos, ativo/inativo, destaque, estoque); catálogo público (lista, categorias em chips, busca, card, indisponível); página de produto (galeria, preço, quantidade, adicionar).
- **Deps:** 2, 3.
- **DoD:** admin cria produto com foto e ele aparece corretamente na loja; produto inativo some do catálogo.

### Fase 5 — Carrinho e checkout
- **Entregas:** `carts`/`cart_items` (persistência por usuário; guest via Zustand + merge no login); carrinho fixo mobile; checkout (login obrigatório, dados do cliente, endereço, observação, forma de pagamento na entrega, revisão); criação do pedido (`orders`+`order_items`) com **validação de estoque no servidor** e **reserva**.
- **Deps:** 4.
- **DoD:** cliente solicita pedido pelo celular; estoque é validado/reservado no servidor; pedido entra como `solicitado`.

### Fase 6 — Pedidos estilo delivery
- **Entregas:** FSM do pedido (`fsm-pedidos.md`) via trigger + guarda server-side; admin aceita/recusa/atualiza status; `order_status_history`; timeline vertical do cliente; **Realtime** para atualização sem recarregar; motivo em recusa/cancelamento.
- **Deps:** 5.
- **DoD:** transições inválidas são rejeitadas; cliente vê status mudar em tempo real; histórico registrado.

### Fase 7 — Pix e WhatsApp (Evolution API)
- **Entregas:** `message_templates` + config Pix em `settings`; cliente Evolution server-side (`lib/evolution`); envio da chave Pix **após aceite**; render de template com variáveis; `notification_logs`; reenvio manual com auditoria; teste de envio no admin.
- **Deps:** 6. Requer instância Evolution + WhatsApp conectado.
- **DoD:** pedido Pix aceito dispara mensagem ao WhatsApp do cliente; log gravado; reenvio funciona.

### Fase 8 — Estoque e dashboard
- **Entregas:** `inventory_movements` (entrada, reserva, liberação, baixa, ajuste); baixa na entrega, liberação em recusa/cancelamento; alerta de estoque mínimo; dashboard (pedidos, faturamento previsto, estoque baixo, atalhos).
- **Deps:** 6.
- **DoD:** admin enxerga operação e estoque crítico; movimentações auditáveis e consistentes.

### Fase 9 — PWA
- **Entregas:** `manifest.ts`, ícones, splash/tema, service worker (cache básico de assets), página offline simples; instruções de instalação Android/iOS.
- **Deps:** 3.
- **DoD:** loja instala na tela inicial e abre com experiência app-like; catálogo já visitado funciona offline (parcial).

### Fase 10 — Domínio e produção
- **Entregas:** domínio Registro.br → Vercel, SSL, Auth URLs de produção, política de privacidade pública, testes finais (checklist mobile), variáveis de produção.
- **Deps:** todas.
- **DoD:** domínio próprio no ar; checklist de testes mobile 100%.

---

## 5. Variáveis de ambiente

`.env.example` (sem segredos reais). **Secrets nunca no client** — só `NEXT_PUBLIC_*` vão ao browser.

```dotenv
# --- Supabase (público) ---
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# --- Supabase (server-only) ---
SUPABASE_SERVICE_ROLE_KEY=        # jamais expor no client

# --- App ---
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# --- Evolution API (server-only) ---
EVOLUTION_API_BASE_URL=
EVOLUTION_API_INSTANCE=
EVOLUTION_API_KEY=                # jamais expor no client

# --- Auth Google (configurado no Supabase Dashboard) ---
# Client ID/Secret ficam no painel Supabase, não aqui.
```

Regras:
- `SUPABASE_SERVICE_ROLE_KEY` e `EVOLUTION_API_KEY` só em Server Actions/Route Handlers.
- A **chave Pix do recebedor** é dado de negócio (não segredo técnico): fica em `settings` com leitura restrita a admin (RLS).

---

## 6. Riscos e mitigações (do plano)

| Risco | Impacto | Mitigação |
|---|---|---|
| Usuário não sabe instalar PWA | Baixo/médio | Experiência completa no navegador + instrução simples por dispositivo |
| iOS ≠ Android (PWA) | Médio | Testar Safari iOS real; documentar limitações |
| Web push complexo | Baixo (MVP) | WhatsApp como canal principal; push fica para fase futura |
| Falha de envio WhatsApp | Médio | `notification_logs`, erro visível no admin, reenvio manual |
| Estoque inconsistente | **Alto** | Validar/reservar no servidor; auditar `inventory_movements` |
| Dados sensíveis expostos | **Alto** | RLS, rotas protegidas, secrets server-side, `audit_logs` |

---

## 7. LGPD (mínimo do MVP)

- Coletar só o necessário: nome, WhatsApp, endereço e histórico operacional.
- Aviso no checkout: WhatsApp será usado para comunicações do pedido e Pix.
- Política de privacidade em rota pública (`/privacidade`).
- Uploads validam tipo, tamanho e permissão.
