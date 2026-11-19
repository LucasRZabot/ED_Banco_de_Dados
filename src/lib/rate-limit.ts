export type RateLimiter = {
  take(key: string, now?: number): boolean;
};

/** Janela deslizante em memória. Serve para uma instância (ECS/EC2); multi-réplica pede Redis. */
export function createRateLimiter(opts: { windowMs: number; max: number }): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    take(key: string, now = Date.now()) {
      const from = now - opts.windowMs;
      const prev = (hits.get(key) ?? []).filter((t) => t > from);
      if (prev.length >= opts.max) {
        hits.set(key, prev);
        return false;
      }
      prev.push(now);
      hits.set(key, prev);
      return true;
    },
  };
}

export function clientKeyFromHeaders(h: Headers) {
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
  return ip;
}

export const loginLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 });
export const presignLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30 });
