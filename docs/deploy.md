# Deploy

Hosting previsto: Cursor publish-app com Postgres da plataforma (`cursor-app.json`). AWS e Firebase Storage
foram descartados. Anexos ficam em `file_blobs` (bytea). Upload autenticado: `POST /api/uploads`.
Download autenticado: `GET /api/files/[id]`, sem URL pública.

Na confirmação do publish-app, escolher **team** (ou **public** se team não existir) — nunca
**private**-only: várias pessoas do hospital compartilham a URL. Auth.js (Credentials JWT) e RBAC
ADMIN / FINANCEIRO / REQUESTER permanecem: o gate do Cursor decide quem abre o app; o login interno
(perfis) é o da aplicação.

## Variáveis

A plataforma define `DATABASE_URL` quando o app declara Postgres. Não commitar nem pedir essa URL.

No Cursor, bind só de nomes não reservados:

| Variável | Notas |
|---|---|
| `AUTH_SECRET` | 32+ bytes. Sessão JWT do Auth.js. |
| `CRON_SECRET` | 16+ chars. Bearer de `GET`/`POST /api/cron/check-deadlines`. |

Opcional no runtime (não são secretos reservados, mas também não precisam de bind):

| Variável | Padrão |
|---|---|
| `AUTH_TRUST_HOST` | `true` atrás do proxy do host |
| `AUTH_SESSION_MAX_AGE_HOURS` | `10` |
| `APP_TIMEZONE` | `America/Sao_Paulo` |
| `ALERT_WARNING_DAYS` | `5` |
| `UPLOAD_MAX_SIZE_MB` | `15` |

`DATABASE_URL`, `AWS_*` e `NEXT_PUBLIC_*` são recusados pelo bind de secrets.

## Build

`npm run build` gera o Next.js e, se `DATABASE_URL` existir, aplica `prisma migrate deploy`. Sem a URL,
o script de migrate não faz nada. **Não roda seed em produção** — nada de `@hospital.local`.

Com o banco vazio, a tela de login pede o primeiro ADMIN (TI) com e-mail real. Depois, em
**Administração → Usuários**, a TI cria cada pessoa (FINANCEIRO, chefias com setor). Senha provisória
com `mustChangePassword`. Sem auto-cadastro.

Health: `GET /api/health` (Postgres). Pronto profundo: `GET /api/health?deep=1` (tabela `file_blobs`).

Cron: sem `Authorization: Bearer <CRON_SECRET>` responde **401**. O job é idempotente (`Notification.dedupeKey`).

Seed só em desenvolvimento: `npm run db:seed` exige `SEED_*` no `.env`. Não sobrescreve contas existentes.
