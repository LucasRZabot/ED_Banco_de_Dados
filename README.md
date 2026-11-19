# Financeiro Hospitalar — Faturamento e Compras

App web interna para chamados de compra/contrato, orçamentos, notas fiscais, boletos e contratos.

Stack: Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind 4 · shadcn/ui (Base UI) ·
Prisma 7 + PostgreSQL · Auth.js v5 (Credentials, sessão JWT) · S3 privado com presigned URLs.

> `CODIGO_script` é um script SQL acadêmico anterior, sem relação com o app.

## Status

| Etapa | Conteúdo | Situação |
|---|---|---|
| 1 | Projeto, schema completo + migration, S3 (presign de upload, download autorizado) | ✅ |
| 2 | Login, troca de senha obrigatória, RBAC, layout com sidebar, gestão de usuários e setores | ✅ |
| 3+ | Chamados, Boletos/Vencimentos, NFs, Orçamentos, Contratos, Dashboard | próximas |

## Perfis

- **ADMIN** — TI. Só gerencia usuários e setores. Não vê chamados, notas nem lançamentos.
- **FINANCEIRO** — a coordenadora. Avalia chamados e lança notas, boletos, contratos e orçamentos. Não cria usuários. Vê tudo o que foi enviado.
- **REQUESTER** — somente **chefias de setor**, sempre vinculadas a um setor (`CHECK` no banco). Cada chefia vê só os chamados que ela abriu e as notas que ela enviou, com o resultado da avaliação.

Fluxo do chamado: Aberto → o Financeiro avalia → Em Processamento → Concluído, ou Cancelado com motivo obrigatório visível para quem abriu. A transição é garantida por trigger no banco.

Não há auto-cadastro. O ADMIN cria a conta em **Administração → Usuários**; o sistema gera uma senha
provisória (exibida uma única vez) e obriga a troca no primeiro acesso. "Redefinir senha" segue o mesmo fluxo.

## Rodando localmente

Pré-requisitos: Node 22+, Docker.

```bash
cp .env.example .env
# gere segredos: AUTH_SECRET (npx auth secret) e CRON_SECRET (openssl rand -hex 24)

docker compose up -d          # postgres:16 + S3 local (moto) em :4566
npm install                   # também roda `prisma generate`
npm run setup                 # migrations + seed + cria bucket/CORS no S3 local
npm run dev                   # http://localhost:3000
```

Contas do seed (senha provisória, troca obrigatória no primeiro login):

| Perfil | E-mail | Senha inicial |
|---|---|---|
| ADMIN (TI) | `admin@hospital.local` | `Admin@123456` |
| Financeiro | `financeiro@hospital.local` | `Financeiro@123456` |
| Chefia (UTI Adulto) | `chefia.uti@hospital.local` | `Chefia@123456` |

E-mails e senhas vêm de `SEED_*` no `.env`. O seed não sobrescreve contas existentes.

> O S3 local (moto) guarda tudo em memória: ao reiniciar o container, rode `npm run s3:setup` de novo.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint / `next typegen` + `tsc` |
| `npm test` | testes unitários (keys do S3, token de upload, políticas) |
| `npm run test:integration` | Postgres + S3 reais: upload, anexo visível só ao autor e ao financeiro, fluxo do chamado, nota pendente, CHECKs |
| `npm run db:migrate` | nova migration em dev |
| `npm run db:deploy` | aplica migrations (prod/CI) |
| `npm run db:seed` | setores de exemplo + admin, financeiro e chefia |
| `npm run s3:setup` | cria bucket privado, bloqueio público e CORS para `APP_URL` |

## Estrutura

```
prisma/                schema.prisma, migrations/ (com CHECKs extras), seed.ts
prisma.config.ts       URL do banco e comando de seed (Prisma 7)
scripts/setup-s3.ts    bucket + CORS
src/proxy.ts           redirecionamento grosso por sessão/perfil (antigo middleware)
src/auth.config.ts     config do Auth.js sem dependências de Node (usada no proxy)
src/auth.ts            Auth.js + Credentials + Prisma
src/lib/dal.ts         requireUser/requireAdmin — relê o usuário no banco a cada requisição
src/lib/s3.ts          presign PUT/GET, HeadObject
src/lib/storage-keys.ts  prefixos notas-fiscais/YYYY/MM, boletos/YYYY/MM, orcamentos, contratos, chamados
src/lib/upload-token.ts  token HMAC que amarra key ↔ usuário ↔ arquivo
src/lib/attachments.ts   attachUploadedFile (valida token + HeadObject) e canViewAttachment
src/app/(auth)/        login, alterar-senha, actions de sessão
src/app/(app)/         layout com sidebar, dashboard, chamados, admin/usuarios, admin/setores
src/app/api/uploads/presign  POST → URL de upload + uploadToken
src/app/api/files/[id]       GET → checa permissão → 302 para URL assinada (5 min)
```

## Fluxo de anexos

1. O navegador chama `POST /api/uploads/presign` com categoria, nome, tipo e tamanho. O servidor valida
   perfil, MIME e tamanho, gera a key (o nome original nunca entra na key) e devolve a URL de PUT e o `uploadToken`.
2. O navegador envia o arquivo direto ao S3 (`src/lib/upload-client.ts`).
3. A server action do módulo chama `attachUploadedFile(uploadToken, user, { ticketId })`. Ela confere a
   assinatura, o dono e a categoria do token, faz `HeadObject` (existência, tamanho e tipo) e grava o `Attachment`.
   O banco guarda só `fileKey`, `fileName`, `fileType` e `fileSize`.
4. O download passa por `/api/files/[id]`, que checa a permissão e redireciona para uma URL assinada.

## Notas de produção

- RDS: `DATABASE_URL` com `sslmode=require`; rode `npm run db:deploy` no deploy.
- S3: bucket criado via IaC, com Block Public Access, SSE e CORS só para o domínio da app. Deixe
  `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` e `S3_ENDPOINT` vazios e use IAM role com apenas
  `s3:PutObject` e `s3:GetObject` em `arn:aws:s3:::<bucket>/*` (o `HeadObject` usa a permissão de GetObject).
- `npm ci --omit=dev` não instala a CLI do Prisma; gere o client no build (`npm ci && npm run build`).
