import { timingSafeEqual } from "node:crypto";

/** Compara o Bearer token com o segredo em tempo constante (mesmo tamanho). */
export function secretMatches(given: string, secret: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function bearerMatches(header: string | null, secret: string) {
  const prefix = "Bearer ";
  const token = header?.startsWith(prefix) ? header.slice(prefix.length) : "";
  return secretMatches(token, secret);
}
