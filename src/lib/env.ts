import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET precisa ter pelo menos 32 caracteres"),
  AUTH_SESSION_MAX_AGE_HOURS: z.coerce.number().int().positive().default(10),
  APP_TIMEZONE: z.string().default("America/Sao_Paulo"),
  ALERT_WARNING_DAYS: z.coerce.number().int().min(1).max(30).default(5),
  CRON_SECRET: z.string().min(16, "CRON_SECRET precisa ter pelo menos 16 caracteres"),
  BOOTSTRAP_SECRET: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().min(16, "BOOTSTRAP_SECRET precisa ter pelo menos 16 caracteres").optional(),
  ),
  UPLOAD_MAX_SIZE_MB: z.coerce.number().positive().default(15),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

// Validação preguiçosa: `next build` importa os módulos sem precisar das variáveis.
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      throw new Error(`Variáveis de ambiente inválidas:\n${issues.join("\n")}`);
    }
    cached = parsed.data;
  }
  return cached;
}
