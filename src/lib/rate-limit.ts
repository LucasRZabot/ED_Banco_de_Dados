export type RateLimiter = {
  take(key: string, now?: number): boolean;
};

/** Janela deslizante em memória. Serve para uma instância; multi-réplica pede Redis. */
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

/**
 * IP do hop confiável do host. Não usa X-Forwarded-For (o cliente pode forjar a 1ª entrada).
 * Sem `x-real-ip` do proxy, a chave cai em "unknown" e o limite fica global na instância.
 */
export function clientKeyFromHeaders(h: Headers) {
  const real = h.get("x-real-ip")?.trim() ?? "";
  if (real && !real.includes(",") && !real.includes(" ")) return real;
  return "unknown";
}

export const loginLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 });
export const uploadLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30 });
