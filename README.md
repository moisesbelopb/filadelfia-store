# Casa de Filadélfia — E-commerce

Loja online estilo *delivery* da Casa de Filadélfia: web responsivo
**mobile-first + PWA opcional**. O cliente **solicita** o pedido, o admin
**aceita** e conduz o status até a entrega. Pagamento **na entrega**; chave
**Pix enviada por WhatsApp** (Evolution API) somente após o aceite.

**Stack:** Next.js 15 (App Router) + TypeScript + Tailwind v4 + shadcn/ui ·
Supabase (Postgres/Auth/Storage/Realtime/RLS) · Deploy Vercel + Registro.br ·
WhatsApp/Pix via Evolution API (server-side) · pnpm.

## Status

✅ **As 10 fases estão implementadas.** App Next.js 15 completo (loja, auth,
pedidos delivery com FSM/Realtime, Pix via WhatsApp, admin, PWA). Build,
typecheck e lint verdes. Roda em **modo demonstração** sem backend.

Para ativar dados reais (Supabase, Google, Evolution, deploy): siga
[`docs/SETUP.md`](docs/SETUP.md).

```bash
pnpm install
pnpm dev          # http://localhost:3000 (modo demonstração)
```

## Documentação

| Doc | Conteúdo |
|---|---|
| [docs/PLANO-EXECUCAO.md](docs/PLANO-EXECUCAO.md) | Visão geral, stack, estrutura de pastas, roadmap das 10 fases, env vars, riscos |
| [docs/schema.sql](docs/schema.sql) | DDL completo (14 tabelas, tipos, índices, triggers) |
| [docs/rls.sql](docs/rls.sql) | Row Level Security + `is_admin()` |
| [docs/fsm-pedidos.md](docs/fsm-pedidos.md) | Máquina de estados do pedido (trigger + guarda server-side) |
| [docs/contratos-api.md](docs/contratos-api.md) | Server Actions, Route Handlers, Zod, contrato Evolution API |

Plano de origem: `Plano_Ecommerce_Casa_de_Filadelfia_Web_Mobile_PWA.docx`.
