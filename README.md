# Financeiro Hospitalar — Faturamento e Compras

App web interna para chamados de compra/contrato, orçamentos, notas fiscais, boletos e contratos.

Stack: Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind 4 · shadcn/ui (Base UI) ·
Prisma 7 + PostgreSQL · Auth.js v5 (Credentials, sessão JWT) · anexos em Postgres (`bytea`).

> `CODIGO_script` é um script SQL acadêmico anterior, sem relação com o app.

## Status

| Etapa | Conteúdo | Situação |
|---|---|---|
| 1 | Projeto, schema completo + migration, anexos privados | ✅ |
| 2 | Login, troca de senha obrigatória, RBAC, layout com sidebar, gestão de usuários e setores | ✅ |
| 3 | Chamados (abertura, avaliação, comentários, notificações) | ✅ |
| 4 | Boletos, cron de vencimentos e dashboard v1 | ✅ |
| 5 | Notas fiscais | ✅ |
| 6 | Orçamentos e conversão | ✅ |
| 7 | Contratos | ✅ |
| 8 | Dashboard completo | ✅ |
| 9 | Preparação para produção (health, headers, docs de deploy) | ✅ |
| 10 | Hosting Cursor (Postgres da plataforma, sem AWS/Firebase) | ⏸ pausado até revisão de lacunas |

## Perfis

- **ADMIN** — TI. Só gerencia usuários e setores. Não vê chamados, notas nem lançamentos.
- **FINANCEIRO** — a coordenação financeira. Avalia chamados e lança notas, boletos, contratos e orçamentos. Não cria usuários. Vê tudo o que foi enviado.
- **REQUESTER** — somente **chefias de setor**, sempre vinculadas a um setor (`CHECK` no banco). Cada chefia vê só os chamados que ela abriu e as notas que ela enviou, com o resultado da avaliação.

Fluxo do chamado: Aberto → o Financeiro avalia → Em Processamento → Concluído, ou Cancelado com motivo obrigatório visível para quem abriu. A transição é garantida por trigger no banco.

Não há auto-cadastro. O ADMIN cria a conta em **Administração → Usuários**; o sistema gera uma senha
provisória (exibida uma única vez) e obriga a troca no primeiro acesso. "Redefinir senha" segue o mesmo fluxo.

## Rodando localmente

Pré-requisitos: Node 22+, Docker.

```bash
cp .env.example .env
# gere segredos: AUTH_SECRET (npx auth secret) e CRON_SECRET (openssl rand -hex 24)

docker compose up -d          # postgres:16
npm install                   # também roda `prisma generate`
npm run setup                 # migrations + seed
npm run dev                   # http://localhost:3000
```

Contas do seed (senha provisória, troca obrigatória no primeiro login):

| Perfil | E-mail | Senha inicial |
|---|---|---|
| ADMIN (TI) | `admin@hospital.local` | `Admin@123456` |
| Financeiro | `financeiro@hospital.local` | `Financeiro@123456` |
| Chefia (UTI Adulto) | `chefia.uti@hospital.local` | `Chefia@123456` |

E-mails e senhas vêm de `SEED_*` no `.env` (com esses padrões se a variável não existir). O seed não sobrescreve contas existentes.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | Next.js (`build` também aplica migrate se houver `DATABASE_URL`; sem seed) |
| `npm run lint` / `typecheck` | ESLint / `next typegen` + `tsc` |
| `npm test` | testes unitários (keys, token de upload, políticas) |
| `npm run test:integration` | Postgres: upload em `file_blobs`, anexo visível só ao autor e ao financeiro, fluxo do chamado, nota pendente, CHECKs |
| `npm run db:migrate` | nova migration em dev |
| `npm run db:deploy` | aplica migrations (prod/CI) |
| `npm run db:seed` | setores de exemplo + admin, financeiro e chefia |

Cron diário (hoje em `America/Sao_Paulo`). Sem o Bearer o endpoint responde 401:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/check-deadlines
curl -s http://localhost:3000/api/health
```

Produção (Cursor publish-app, Postgres da plataforma): **[docs/deploy.md](docs/deploy.md)**.
Visibilidade **team** ou **public**, nunca só private. Sem seed `@hospital.local` em produção:
o primeiro acesso cria o ADMIN de TI; as demais contas saem de **Administração → Usuários**.

## Estrutura

```
cursor-app.json        declara Postgres no host Cursor
prisma/                schema.prisma, migrations/ (com CHECKs extras), seed.ts
prisma.config.ts       URL do banco e comando de seed (Prisma 7)
scripts/migrate.mjs    migrate deploy no build quando há DATABASE_URL (sem seed)
src/proxy.ts           redirecionamento grosso por sessão/perfil (antigo middleware)
src/auth.config.ts     config do Auth.js sem dependências de Node (usada no proxy)
src/auth.ts            Auth.js + Credentials + Prisma
src/lib/dal.ts         requireUser/requireAdmin — relê o usuário no banco a cada requisição
src/lib/blobs.ts       grava/lê anexos em file_blobs (bytea)
src/lib/storage-keys.ts  prefixos notas-fiscais/YYYY/MM, boletos/YYYY/MM, orcamentos, contratos, chamados
src/lib/upload-token.ts  token HMAC que amarra key ↔ usuário ↔ arquivo
src/lib/attachments.ts   attachUploadedFile (valida token + blob) e canViewAttachment
src/app/(auth)/        login, alterar-senha, actions de sessão
src/app/(app)/         layout com sidebar, dashboard, chamados, boletos, notificacoes, admin/usuarios, admin/setores
src/features/tickets   abertura, lista, detalhe, máquina de status, comentários
src/features/bills     cadastro, lista, baixa, filtros
src/features/dashboard cards de vencimento
src/features/notifications  sino, página, fan-out idempotente
src/server/jobs        check-deadlines (cron HTTP)
src/lib/validators     CNPJ e linha digitável
src/app/api/uploads          POST multipart autenticado → bytea + uploadToken
src/app/api/files/[id]       GET → checa permissão → bytes (sem URL pública)
```

## Fluxo de anexos

1. O navegador chama `POST /api/uploads` (multipart) com o arquivo e a categoria. O servidor valida
   perfil, MIME e tamanho, gera a key (o nome original nunca entra na key) e grava o conteúdo em `file_blobs`.
2. A resposta traz só `fileKey` e `uploadToken` — o arquivo não ganha URL pública.
3. A server action do módulo chama `attachUploadedFile(uploadToken, user, { ticketId })`. Ela confere a
   assinatura, o dono e a categoria do token, verifica o blob (existência, tamanho e tipo) e grava o `Attachment`.
4. O download passa por `/api/files/[id]`, autenticado: quem não pode ver recebe 404; quem pode recebe o
   arquivo com `Cache-Control: private, no-store`.

## Notas de produção

Ver o guia completo em **[docs/deploy.md](docs/deploy.md)**. Resumo:

- `cursor-app.json` pede Postgres; a plataforma define `DATABASE_URL`. Bind só `AUTH_SECRET` e `CRON_SECRET`.
- Anexos em bytea; sem S3/Firebase.
- Cron → `POST /api/cron/check-deadlines` com `Authorization: Bearer $CRON_SECRET`.
- Healthcheck: `GET /api/health`. Cabeçalhos de segurança no `next.config.ts`.
