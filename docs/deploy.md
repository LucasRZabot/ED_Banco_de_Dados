# Deploy em produção (Firebase)

Este documento descreve **como** colocar o app no ar. Ele **não cria** o projeto Firebase: isso é um clique seu no console. Prisma continua no PostgreSQL gerenciado — Firestore seria reescrever o modelo.

Runtime: Node 22, Firebase **App Hosting** (Next.js App Router em Cloud Run + CDN). Anexos no **Firebase Storage** (URLs assinadas, bucket privado). Cron diário no **Cloud Scheduler** → `POST /api/cron/check-deadlines`. Healthcheck: `GET /api/health` (200). Pronto profundo: `GET /api/health?deep=1` (também testa o bucket).

Não use AWS. A publicação na AWS foi cancelada (SCP da organização).

## 1. Clique agora no Firebase

1. Abra [https://console.firebase.google.com/](https://console.firebase.google.com/).
2. Clique em **Create a project** (ou **Add project**).
3. Nome sugerido: `financeiro-hospital`. Aceite o Google Analytics se quiser; não é obrigatório.
4. Quando o projeto abrir: engrenagem → **Project settings** → anote o **Project ID**.
5. No aviso de upgrade, clique em **Upgrade** para o plano **Blaze** (App Hosting e Cloud Scheduler exigem). O free tier do Blaze cobre o volume deste MVP se o scale-to-zero ficar ligado.

## 2. Postgres gerenciado (Prisma, sem Firestore)

Crie um PostgreSQL 16 **fora** do Firestore. Caminho menor: [Neon](https://console.neon.tech/) (ou Cloud SQL com IP público + `sslmode=require`).

1. Crie um projeto Postgres 16.
2. Copie a connection string **só** para o cofre abaixo. Formato:
   `postgresql://USER:SENHA@HOST:5432/DB?sslmode=require`
3. **Não cole a URL no chat.**

Cloud SQL no mesmo projeto Google também serve; o App Hosting **não** monta o socket `/cloudsql` pelo `apphosting.yaml`. Prefira host TCP + SSL.

## 3. Storage

1. No Firebase Console: **Build → Storage → Get started**.
2. Escolha **production mode** (as rules do repositório já negam leitura/escrita pelo SDK do cliente).
3. O bucket fica `PROJECT_ID.firebasestorage.app` (ou `PROJECT_ID.appspot.com` em projetos antigos).
4. Depois que o App Hosting existir, rode na sua máquina (ADC, sem colar chave):

```bash
gcloud auth application-default login
export GCS_BUCKET=PROJECT_ID.firebasestorage.app
export APP_URL=https://financeiro--PROJECT_ID.us-central1.hosted.app
npm run storage:setup:gcs
```

Ou no Cloud Shell: `gcloud storage buckets update gs://$GCS_BUCKET --cors-file=storage.cors.json` (edite o `origin` para o `APP_URL` real).

## 4. Segredos — nomes, nunca valores no chat

Crie os valores **localmente** (`npx auth secret`, `openssl rand -hex 24`, URL do Neon). Depois grave nos dois cofres:

### Firebase (obrigatório para o site no ar)

Console → **App Hosting** → backend `financeiro` → **Settings → Environment** → **Add new** → tipo **Secret**.

| Nome do secret (exatamente) | O que é |
|---|---|
| `DATABASE_URL` | Postgres com `sslmode=require` |
| `AUTH_SECRET` | ≥ 32 caracteres (`npx auth secret`) |
| `CRON_SECRET` | ≥ 16 caracteres (`openssl rand -hex 24`) |

O `apphosting.yaml` já referencia esses três nomes. Sem eles o rollout falha.

Não versione `SEED_*`. Não coloque senha de exemplo em produção.

### Cursor My Secrets (opcional, só para Cloud Agents futuros)

Dashboard → [Cloud Agents → Secrets](https://cursor.com/dashboard/cloud-agents), tipo **Runtime Secret**, mesmos nomes: `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`. Isso **não** publica o app; o runtime de produção é o Firebase.

Não use o cofre do `publish-app` (`bind-app-secrets`): ele recusa `DATABASE_URL`.

## 5. App Hosting (Next.js)

O repositório já tem `firebase.json` (`backendId: financeiro`), `apphosting.yaml` e o adapter de Storage.

1. Console → **Hosting & Serverless → App Hosting → Get started** (ou **Create backend**).
2. Região: `us-central1` (ou a mais próxima).
3. Conecte o GitHub e escolha `LucasRZabot/ED_Banco_de_Dados`.
4. Root directory: `/`. Live branch: `main` (depois do merge deste PR).
5. **Backend ID: `financeiro`** — precisa bater com `firebase.json`.
6. Runtime: **Node.js 22**. Automatic rollouts ligados.
7. Em **Environment / Secrets**, anexe `DATABASE_URL`, `AUTH_SECRET` e `CRON_SECRET`.
8. **Finish and deploy**.

URL: `https://financeiro--PROJECT_ID.us-central1.hosted.app`.

IAM depois do primeiro rollout (Google Cloud Console → IAM), na service account `firebase-app-hosting-compute@PROJECT_ID.iam.gserviceaccount.com`:

- `roles/storage.objectAdmin` no bucket (URLs assinadas de PUT/GET)
- `roles/iam.serviceAccountTokenCreator` **nela mesma** (sem isso o `getSignedUrl` falha no Cloud Run)

Rules: `firebase deploy --only storage` (ou o Get started em production mode já deixa o bucket fechado; o arquivo `storage.rules` é a fonte).

## 6. Cloud Scheduler (cron diário)

O job HTTP já existe: `GET` ou `POST /api/cron/check-deadlines`. Sem `Authorization: Bearer <CRON_SECRET>` responde **401**.

1. [Cloud Scheduler](https://console.cloud.google.com/cloudscheduler) → **Enable API** se pedido → **Create job**.
2. Nome: `check-deadlines`. Região: a mesma do App Hosting.
3. Frequency: `0 8 * * *`. Timezone: `America/Sao_Paulo`.
4. Target: **HTTP**. URL: `https://financeiro--PROJECT_ID.us-central1.hosted.app/api/cron/check-deadlines`.
5. Method: `POST`.
6. Header: `Authorization` = `Bearer ` + o mesmo valor de `CRON_SECRET` (o console do Scheduler guarda o header; não cole no chat).
7. Auth header da plataforma: **Add** (nenhum OIDC — o Bearer da aplicação já autentica).

O job é idempotente (`Notification.dedupeKey`). Rodar duas vezes no mesmo dia não duplica alerta.

## Variáveis

| Variável | Produção | Notas |
|---|---|---|
| `STORAGE_PROVIDER` | `gcs` | Já está no `apphosting.yaml`. |
| `GCS_BUCKET` | opcional | Sem ela, usa `FIREBASE_CONFIG.storageBucket`. |
| `APP_URL` | URL `*.hosted.app` | Só para CORS (`npm run storage:setup:gcs`). |
| `APP_TIMEZONE` | `America/Sao_Paulo` | "Hoje" dos vencimentos e do cron. |
| `ALERT_WARNING_DAYS` | `5` | Amarelo no dashboard. |
| `DATABASE_URL` | secret | Prisma/Postgres. |
| `AUTH_SECRET` | secret | Sessão JWT. |
| `AUTH_TRUST_HOST` | `true` | Obrigatório atrás do proxy do App Hosting. |
| `AUTH_SESSION_MAX_AGE_HOURS` | `10` | |
| `CRON_SECRET` | secret | Bearer do cron. **Nunca** na URL. |
| `STORAGE_PRESIGN_EXPIRES_SECONDS` | `300` | |
| `UPLOAD_MAX_SIZE_MB` | `15` | |
| `RUN_DB_MIGRATE` | `1` | Só no build do App Hosting (`prisma migrate deploy`). |
| `SEED_*` | **omitir** | Seed só em desenvolvimento. |

Localmente o docker compose ainda sobe Postgres + S3 (moto) com `STORAGE_PROVIDER` implícito `s3`. Isso não é AWS de produção.

## Primeiro ADMIN

Sem seed o banco sobe vazio. Na sua máquina, com `DATABASE_URL` de produção **no seu terminal** (não no chat):

```bash
export SEED_ADMIN_EMAIL=seu-email
export SEED_ADMIN_PASSWORD='uma-provisoria-longa'
npx prisma db seed
```

O seed não sobrescreve contas existentes. Troca de senha continua obrigatória no primeiro login. Crie a coordenadora depois em `/admin/usuarios`.

## Conferência

```bash
curl -s https://financeiro--PROJECT_ID.us-central1.hosted.app/api/health
curl -s https://financeiro--PROJECT_ID.us-central1.hosted.app/api/health?deep=1
curl -H "Authorization: Bearer $CRON_SECRET" https://financeiro--PROJECT_ID.us-central1.hosted.app/api/cron/check-deadlines
```

Cabeçalhos (`X-Frame-Options: DENY`, `nosniff`, HSTS) saem do `next.config.ts`. Rate limit em memória no login e no presign (uma instância; Redis fica para depois).

Sentry, e-mail de alerta e auditoria genérica continuam no backlog pós-MVP.
