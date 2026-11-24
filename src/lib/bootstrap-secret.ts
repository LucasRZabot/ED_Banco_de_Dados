import { secretMatches } from "@/lib/timing-safe";

export function configuredBootstrapSecret() {
  const s = process.env.BOOTSTRAP_SECRET?.trim() ?? "";
  return s.length >= 16 ? s : null;
}

export function bootstrapSecretMatches(given: string) {
  const expected = configuredBootstrapSecret();
  if (!expected) return false;
  return secretMatches(given, expected);
}