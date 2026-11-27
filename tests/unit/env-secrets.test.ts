import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("segredos de auth", () => {
  it("não embarca AUTH_SECRET, JWT fallback nem senha de seed", () => {
    const envSrc = readFileSync("src/lib/env.ts", "utf8");
    const authHost = readFileSync("src/lib/auth-host.ts", "utf8");
    const example = readFileSync(".env.example", "utf8");
    const readme = readFileSync("README.md", "utf8");
    const deploy = readFileSync("docs/deploy.md", "utf8");
    const blob = [envSrc, authHost, example, readme, deploy].join("\n");

    expect(envSrc).not.toMatch(/localAuthSecret|dev-only-not-for-production/);
    expect(envSrc).toMatch(/AUTH_SECRET: z\.string\(\)\.min\(32/);
    expect(authHost).not.toMatch(/throw new Error/);
    expect(blob).not.toMatch(/Admin@123456|Financeiro@123456|Chefia@123456/);
    expect(example).toMatch(/^AUTH_SECRET=$/m);
    expect(example).toMatch(/^CRON_SECRET=$/m);
    expect(example).toMatch(/^BOOTSTRAP_SECRET=$/m);
  });
});
