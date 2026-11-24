import "server-only";
import { z } from "zod";

const localAuthSecret = "local-dev-only-auth-secret-not-for-production";
const localCronSecret = "local-dev-only-cron-secret";

function secretFromEnv(name: string, localFallback: string, min: number) {
  const value = process.env[name]?.trim() ?? "";
  if (value) return value;
  if (process.env.NODE_ENV === "production") return undefined;
  const fallback = localFallback.length >= min ? localFallback : `${localFallback}${"x".repeat(min)}`;
  process.env[name] = fallback;
  return fallback;
}

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET precisa ter pelo menos 32 caracteres"),
  AUTH_SESSION_MAX_AGE_HOURS: z.coerce.number().int().positive().default(10),
  APP_TIMEZONE: z.string().default("America/Sao_Paulo"),
  ALERT_WARNING_DAYS: z.coerce.number().int().min(1).max(30).default(5),
  CRON_SECRET: z.string().min(16, "CRON_SECRET precisa ter pelo menos 16 caracteres"),
  UPLOAD_MAX_SIZE_MB: z.coerce.number().positive().default(15),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

// Validação preguiçosa: `next build` importa os módulos sem precisar das variáveis.
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse({
      ...process.env,
      AUTH_SECRET: secretFromEnv("AUTH_SECRET", localAuthSecret, 32),
      CRON_SECRET: secretFromEnv("CRON_SECRET", localCronSecret, 16),
    });
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      throw new Error(`Variáveis de ambiente inválidas:\n${issues.join("\n")}`);
    }
    cached = parsed.data;
  }
  return cached;
}
