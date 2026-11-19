import { describe, expect, it } from "vitest";
import { bearerMatches } from "@/lib/timing-safe";

describe("bearerMatches", () => {
  it("aceita o segredo certo e rejeita o resto", () => {
    const secret = "cron-secret-16chars";
    expect(bearerMatches(`Bearer ${secret}`, secret)).toBe(true);
    expect(bearerMatches(`Bearer ${secret}x`, secret)).toBe(false);
    expect(bearerMatches("Bearer xxxxxxxxxxxxxxxxxxx", secret)).toBe(false);
    expect(bearerMatches(null, secret)).toBe(false);
    expect(bearerMatches(secret, secret)).toBe(false);
  });
});
