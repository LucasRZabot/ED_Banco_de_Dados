import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { GET as healthGet } from "@/app/api/health/route";
import { GET as cronGet } from "@/app/api/cron/check-deadlines/route";
import { db } from "@/lib/db";

describe("health e cron em produção", () => {
  it("GET /api/health responde 200 com o Postgres no ar", async () => {
    const res = await healthGet(new Request("http://localhost/api/health"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.checks.db).toBe("ok");
    expect(body.checks.s3).toBeUndefined();
  });

  it("GET /api/health?deep=1 inclui o armazenamento em Postgres", async () => {
    const res = await healthGet(new Request("http://localhost/api/health?deep=1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.checks.storage).toBe("ok");
    expect(body.checks.s3).toBeUndefined();
  });

  it("cron recusa Bearer errado e aceita o CRON_SECRET", async () => {
    const denied = await cronGet(
      new Request("http://localhost/api/cron/check-deadlines", {
        headers: { authorization: "Bearer not-the-secret-value-000" },
      }),
    );
    expect(denied.status).toBe(401);

    const missing = await cronGet(new Request("http://localhost/api/cron/check-deadlines"));
    expect(missing.status).toBe(401);

    const ok = await cronGet(
      new Request("http://localhost/api/cron/check-deadlines", {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    );
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

afterAll(async () => {
  await db.$disconnect();
});
