# Deploy em produção

Este documento descreve **como** colocar o app no ar. Ele **não cria** recursos AWS: RDS, S3 e EventBridge devem ser provisionados à parte (console, Terraform, CDK). Aqui só o que a aplicação espera.

Runtime: Node 22, `npm run build` + `npm start` (ou a imagem `Dockerfile` com `output: "standalone"`). Healthcheck do load balancer: `GET /api/health` (200). Pronto profundo: `GET /api/health?deep=1` (também testa o bucket).

## Variáveis (espelho do `.env.example`)

| Variável | Produção | Notas |
|---|---|---|
| `APP_URL` | `https://financeiro.exemplo` | Origem canônica. CORS do S3 e links. |
| `APP_TIMEZONE` | `America/Sao_Paulo` | "Hoje" dos vencimentos e do cron. |
| `ALERT_WARNING_DAYS` | `5` | Amarelo no dashboard. |
| `DATABASE_URL` | RDS Postgres 16 com `?sslmode=require` | Sem as vars `POSTGRES_*` (só o Compose local). |
| `AUTH_SECRET` | 32+ bytes aleatórios | `npx auth secret` ou `openssl rand -base64 32`. Sessão JWT. |
| `AUTH_TRUST_HOST` | `true` | Obrigatório atrás de ALB/proxy. |
| `AUTH_SESSION_MAX_AGE_HOURS` | `10` | |
| `CRON_SECRET` | 16+ chars aleatórios | `openssl rand -hex 24`. Bearer do cron. **Nunca** na URL. |
| `AWS_REGION` | `sa-east-1` | |
| `S3_BUCKET` | nome do bucket privado | |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | **vazio** | IAM role da tarefa/instância. |
| `S3_ENDPOINT` | **vazio** | Só o moto local usa endpoint. |
| `S3_FORCE_PATH_STYLE` | `false` | |
| `S3_PRESIGN_EXPIRES_SECONDS` | `300` | |
| `UPLOAD_MAX_SIZE_MB` | `15` | |
| `SEED_*` | **omitir** | Seed só em desenvolvimento. |

Guarde `AUTH_SECRET`, `CRON_SECRET` e `DATABASE_URL` no Secrets Manager / SSM. Não copie o `.env` de dev.

## RDS (PostgreSQL 16)

1. Crie uma instância (ou Aurora) PostgreSQL 16. Backups automáticos; Multi-AZ se a criticidade pedir.
2. Security group: porta 5432 só a partir do SG do ECS/EC2. Sem 0.0.0.0/0.
3. `DATABASE_URL=postgresql://USER:SENHA@HOST:5432/DB?sslmode=require`
4. No deploy, **antes** de subir a app: `npm run db:deploy` (Prisma migrate). Sem seed.

## S3 privado

1. Bucket na mesma região, **Block Public Access** ligado, SSE-S3 (ou KMS).
2. CORS só para `APP_URL` (PUT/GET, headers `Content-Type` e `Content-Disposition`).
3. IAM role da tarefa, privilégio mínimo:

```
s3:PutObject, s3:GetObject, s3:HeadObject  em  arn:aws:s3:::BUCKET/*
s3:ListBucket, s3:HeadBucket               em  arn:aws:s3:::BUCKET
```

`HeadObject` usa a permissão de `GetObject`. Sem chaves estáticas no container.

## EventBridge (cron diário)

O job HTTP já existe: `GET` ou `POST /api/cron/check-deadlines`. Sem `Authorization: Bearer <CRON_SECRET>` responde **401** (comparação em tempo constante).

Sugestão: EventBridge Scheduler, uma vez por dia às 08:00 em `America/Sao_Paulo`:

- Expressão: `cron(0 8 * * ? *)` com timezone `America/Sao_Paulo`.
- Alvo: API Destination HTTPS para `https://<APP_URL>/api/cron/check-deadlines`.
- Connection: header `Authorization` = `Bearer <CRON_SECRET>` (o segredo fica na connection, não no schedule).
- Método: `POST` (o GET também funciona).

Em EC2 sem EventBridge, um systemd timer ou `cron` do host com `curl -H "Authorization: Bearer $CRON_SECRET"` equivale.

O job é idempotente (`Notification.dedupeKey`). Rodar duas vezes no mesmo dia não duplica alerta.

## App (ECS Fargate ou EC2 + Docker)

1. Build: `npm ci && npm run build` (gera o client Prisma; não use `npm ci --omit=dev` no estágio de build).
2. Imagem: `docker build -t financeiro .` (Dockerfile multi-stage, `output: "standalone"`).
3. Health check do ALB/ECS: `GET /api/health`, intervalo ~30s, unhealthy threshold 3. Não autentica.
4. Cabeçalhos (`X-Frame-Options: DENY`, `nosniff`, HSTS em produção) saem do `next.config.ts`.
5. Rate limit em memória: 10 logins / 10 min por IP; 30 presigns / min por usuário. Várias réplicas não compartilham o contador (Redis fica para depois).

Sentry, e-mail de alerta e auditoria genérica continuam no backlog pós-MVP.
