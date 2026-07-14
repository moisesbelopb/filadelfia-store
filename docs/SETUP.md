# Setup — Casa de Filadélfia

Passo a passo para rodar localmente e publicar em produção.

## 1. Rodar localmente

```bash
pnpm install
cp .env.example .env.local   # deixe vazio para "modo demonstração"
pnpm dev                     # http://localhost:3000
```

Sem Supabase configurado, a loja roda em **modo demonstração** (catálogo de
exemplo, sem login/checkout reais) e o `/admin` fica acessível para pré-visualizar.

Scripts úteis:
- `pnpm build` · `pnpm start` — build de produção
- `pnpm typecheck` — checagem de tipos
- `pnpm lint` / `pnpm format` — Biome

## 2. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **Project Settings → API**, copie para `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
3. Rode as migrations na ordem (SQL Editor ou Supabase CLI):
   `supabase/migrations/0001_schema.sql` → `0002_rls.sql` → `0003_order_fsm.sql`
   → `0004_orders_inventory.sql` → `0005_storage.sql`.
4. (Opcional) Rode `supabase/seed.sql` para dados de exemplo.
5. **Realtime:** em **Database → Replication**, habilite a tabela `orders`
   (a timeline do cliente usa Realtime).

### Administrador nativo (recomendado)
Com o Supabase configurado no `.env.local` (URL + service role), crie o admin
padrão com um comando:
```bash
pnpm create-admin
# usa ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD do .env.local
# ou: pnpm create-admin email@exemplo.com SuaSenhaForte
```
Isso cria (ou atualiza) o usuário com e-mail confirmado e papel `super_admin`.
Depois é só entrar em `/login` e acessar `/admin`.

O **super admin** cria e gerencia os demais administradores dentro do painel em
**`/admin/usuarios`** (criar usuário, promover/rebaixar entre cliente / admin /
super_admin). Todas as ações ficam registradas em `audit_logs`.

### Promover um admin manualmente (alternativa)
Após se cadastrar na loja, promova seu usuário (SQL Editor):
```sql
update public.profiles set role = 'super_admin'
where id = (select id from auth.users where email = 'voce@exemplo.com');
```

## 3. Login com Google

> Se o botão "Continuar com Google" volta para o `/login` sem logar, quase sempre
> é uma das URLs abaixo fora do lugar. Siga os 3 passos na ordem.

**a) Google Cloud Console** (console.cloud.google.com → APIs & Services → Credentials)
1. **OAuth consent screen**: configure (External) com nome e e-mail de suporte.
2. **Create credentials → OAuth client ID → Web application**.
3. Em **Authorized redirect URIs**, adicione a URL de callback do **Supabase**
   (não a do app):
   `https://SEU_PROJETO.supabase.co/auth/v1/callback`
   (copie a exata em Supabase → Authentication → Providers → Google).
4. Copie o **Client ID** e o **Client Secret**.

**b) Supabase → Authentication → Providers → Google**
- Ative e cole **Client ID** e **Client Secret**.

**c) Supabase → Authentication → URL Configuration**
- **Site URL**: `http://localhost:3000` (dev) ou `https://SEU_DOMINIO` (prod).
- **Redirect URLs** (as do app, para onde voltamos após o login):
  - `http://localhost:3000/api/auth/callback`
  - `https://SEU_DOMINIO/api/auth/callback`

> ⚠️ Garanta que **`NEXT_PUBLIC_SITE_URL`** no `.env.local` bate com o ambiente
> (dev: `http://localhost:3000`; prod: `https://SEU_DOMINIO`). É a partir dele
> que montamos o `redirectTo` do OAuth — se estiver errado, o Google devolve para
> o host errado e o login "não completa".

**Primeiro acesso com Google:** como o Google não fornece telefone, o usuário é
levado a **`/completar-perfil`** para informar o **WhatsApp** (usado nos avisos do
pedido) antes de seguir. Nas próximas vezes o login vai direto.

## 4. Evolution API (WhatsApp/Pix)

Já existe uma stack Docker pronta em [`evolution/`](../evolution/README.md)
(Evolution API **v2.3.7** + Postgres + Redis):

```bash
cd evolution && docker compose up -d      # sobe em http://localhost:8085
```

O `.env.local` já aponta para ela:
```dotenv
EVOLUTION_API_BASE_URL=http://localhost:8085
EVOLUTION_API_INSTANCE=filadelfia
EVOLUTION_API_KEY=<a mesma AUTHENTICATION_API_KEY do evolution/.env>
```

**Conectar o WhatsApp:** admin → `/admin/configuracoes/whatsapp` →
**Conectar WhatsApp** → escaneie o QR (WhatsApp → Aparelhos conectados).
Na mesma página, mais abaixo, configure a **chave Pix** e o **template** da
mensagem (o Pix é só uma mensagem de WhatsApp — não gera QR de pagamento) e
use **Enviar teste**.

> ⚠️ Use a imagem **v2.3.7** (ou mais recente). A v2.1.1 traz um Baileys
> desatualizado que entra em loop e não emite o QR. Em produção, hospede a
> Evolution em um servidor com HTTPS e ajuste `EVOLUTION_API_BASE_URL`.
> Detalhe do corpo do `sendText` isolado em `lib/evolution/client.ts`.

## 5. ZeptoMail / Zoho (e-mails do pedido)

E-mails transacionais são enviados ao **cliente** em cada etapa do pedido:
recebido (checkout), confirmado, em separação, pronto para retirada **ou** saiu
para entrega (conforme `fulfillment_type`), entregue, recusado e cancelado.
Usa a Email API do [ZeptoMail](https://www.zoho.com/zeptomail/) via `fetch` —
sem dependências extras. O destinatário vem do cadastro (Auth); o checkout não
coleta e-mail.

Mapa status → e-mail: `emailEventForStatus()` em `lib/email/defaults.ts`.
Disparo: `actions/orders.ts` (criação) e `actions/admin/orders.ts` (transições).
Textos editáveis em **/admin/configuracoes/whatsapp → Comunicação**.

### 5.1 Verificar o domínio no ZeptoMail

O ZeptoMail **não usa mais SPF** para verificar domínio: são **DKIM (TXT)** e
**CNAME** (return-path dos bounces).

1. Entre em [zeptomail.zoho.com](https://zeptomail.zoho.com) com a conta Zoho do
   domínio.
2. **Domains → Add Domain** → informe o domínio → **Add**.
3. O ZeptoMail mostra um **TXT (DKIM)** e um **CNAME**. Copie host e valor dos dois.
4. Adicione os registros **onde o DNS do domínio é gerenciado** — confira os
   nameservers antes (`nslookup -type=NS SEU_DOMINIO`). Não é necessariamente o
   Registro.br: se os NS apontarem para a hospedagem (ex.: `cns1.odara.com.br`),
   os registros entram no painel dela (cPanel → *Zone Editor*).
5. Volte ao ZeptoMail e clique em **Verify**. A propagação leva de minutos a 48h.

> ⚠️ **Só pode existir UM registro SPF** (`v=spf1 …`) por domínio. Dois ou mais
> geram `PermError` e derrubam a entrega — inclusive a do Zoho Mail. Se houver
> duplicidade, mescle tudo em um único TXT.

### 5.2 Criar o Mail Agent e pegar o token

1. No ZeptoMail, **Add Agent** → nome, domínio e descrição → **Add**.
2. Abra o agente → aba **SMTP/API** → copie o **Send Mail Token**.
3. O painel mostra `Zoho-enczapikey <token>`. Guarde **apenas o token**, sem o
   prefixo — o código já envia o header `Authorization: Zoho-enczapikey <token>`
   (`lib/email/zeptomail.ts`).

### 5.3 Configurar as variáveis

Local, em `.env.local`:

```dotenv
ZEPTOMAIL_TOKEN=<send mail token>
ZEPTOMAIL_FROM_EMAIL=contato@SEU_DOMINIO   # caixa do domínio verificado
ZEPTOMAIL_FROM_NAME=Casa de Filadélfia
# ZEPTOMAIL_API_URL=https://api.zeptomail.eu/v1.1/email  # só se a conta for EU
```

Produção: repita as mesmas variáveis na **Vercel** (*Settings → Environment
Variables*, ambiente **Production**) e **refaça o deploy** — variável nova só
vale no próximo build.

### 5.4 Testar

Em **/admin/configuracoes/whatsapp → Comunicação**, escolha um modelo e clique em
**Enviar teste para mim**: o e-mail sai com um pedido fictício para o endereço do
admin logado (`actions/admin/email.ts`). Erro do ZeptoMail (token inválido,
remetente não verificado…) aparece no toast.

Sem as variáveis, o envio é silenciosamente ignorado (o pedido nunca falha por
causa do e-mail). Cada envio real fica registrado em `notification_logs`
(`channel = 'email'`). Templates: `lib/email/templates.ts`.

## 6. Deploy na Vercel + domínio (Registro.br)

1. Importe o repositório na [Vercel](https://vercel.com).
2. Configure as **Environment Variables** (as mesmas do `.env.local`), com
   `NEXT_PUBLIC_SITE_URL=https://SEU_DOMINIO`.
3. Em **Settings → Domains**, adicione o domínio e siga as instruções de DNS.
4. No **Registro.br**, aponte o DNS conforme a Vercel (registro A/CNAME).
5. Atualize as Redirect URLs do Supabase com o domínio de produção.

## Checklist de testes (mobile)
Abrir loja · adicionar ao carrinho · cadastro/login · finalizar pedido ·
acompanhar status · admin aceitar · Pix via WhatsApp · adicionar PWA à tela
inicial · validar layout sem cortes (Android Chrome, iPhone Safari, tablet,
desktop).
