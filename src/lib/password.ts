import "server-only";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";

const COST = 12;

// Comparação contra um hash real quando o e-mail não existe, para o tempo de resposta não revelar contas.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hash("conta-inexistente", COST));

export const passwordSchema = z
  .string()
  .min(10, "A senha deve ter pelo menos 10 caracteres.")
  .max(128, "A senha deve ter no máximo 128 caracteres.")
  .regex(/[a-zA-Z]/, "A senha deve conter letras.")
  .regex(/[0-9]/, "A senha deve conter números.");

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string | null | undefined) {
  if (!hash) {
    await bcrypt.compare(plain, await getDummyHash());
    return false;
  }
  return bcrypt.compare(plain, hash);
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generateTemporaryPassword(length = 12) {
  let out = "";
  for (let i = 0; i < length - 2; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out + String(randomInt(10)) + String(randomInt(10));
}
