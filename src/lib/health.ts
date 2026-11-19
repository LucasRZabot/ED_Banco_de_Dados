import { db } from "@/lib/db";
import { headBucket } from "@/lib/s3";

export type HealthCheck = "ok" | "error";

export type HealthSnapshot = {
  ok: boolean;
  status: "ok" | "degraded" | "error";
  checks: { db: HealthCheck; s3?: HealthCheck };
  timezone: string;
  time: string;
};

export async function getHealthSnapshot(opts: { deep?: boolean } = {}): Promise<HealthSnapshot> {
  const time = new Date().toISOString();
  const timezone = process.env.APP_TIMEZONE ?? "America/Sao_Paulo";
  const checks: HealthSnapshot["checks"] = { db: "error" };

  try {
    await db.$queryRaw`SELECT 1`;
    checks.db = "ok";
  } catch {
    checks.db = "error";
  }

  if (opts.deep) {
    try {
      await headBucket();
      checks.s3 = "ok";
    } catch {
      checks.s3 = "error";
    }
  }

  const failed = Object.values(checks).some((v) => v === "error");
  return {
    ok: !failed,
    status: failed ? (checks.db === "error" ? "error" : "degraded") : "ok",
    checks,
    timezone,
    time,
  };
}
