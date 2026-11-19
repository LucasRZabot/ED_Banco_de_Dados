import { describe, expect, it } from "vitest";
import { clientKeyFromHeaders, createRateLimiter } from "@/lib/rate-limit";
import { securityHeaders } from "@/lib/security-headers";

describe("rate limiter", () => {
  it("bloqueia depois do máximo na janela e libera depois", () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 2 });
    const t0 = 1_000_000;
    expect(limiter.take("a", t0)).toBe(true);
    expect(limiter.take("a", t0 + 10)).toBe(true);
    expect(limiter.take("a", t0 + 20)).toBe(false);
    expect(limiter.take("b", t0 + 20)).toBe(true);
    expect(limiter.take("a", t0 + 1001)).toBe(true);
  });

  it("lê o IP de X-Forwarded-For", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
    expect(clientKeyFromHeaders(h)).toBe("203.0.113.9");
    expect(clientKeyFromHeaders(new Headers())).toBe("unknown");
  });
});

describe("security headers", () => {
  it("sempre envia nosniff e DENY; HSTS só em produção", () => {
    const dev = securityHeaders(false);
    const prod = securityHeaders(true);
    expect(dev.some((h) => h.key === "X-Content-Type-Options" && h.value === "nosniff")).toBe(true);
    expect(dev.some((h) => h.key === "X-Frame-Options" && h.value === "DENY")).toBe(true);
    expect(dev.some((h) => h.key === "Strict-Transport-Security")).toBe(false);
    expect(prod.some((h) => h.key === "Strict-Transport-Security")).toBe(true);
  });
});
