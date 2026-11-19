import { createHmac, timingSafeEqual } from "node:crypto";
import type { AttachmentCategoryKey } from "@/lib/storage-keys";

/**
 * Token emitido junto com a presigned URL. Prova que a key foi gerada pelo servidor
 * para aquele usuário, categoria e arquivo; a server action que grava o anexo o exige.
 */
export type UploadClaims = {
  key: string;
  userId: string;
  category: AttachmentCategoryKey;
  fileName: string;
  fileType: string;
  fileSize: number;
  exp: number; // epoch em segundos
};

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

function sign(payload: string, secret: string) {
  return createHmac("sha256", `upload-token:${secret}`).update(payload).digest();
}

export function createUploadToken(claims: UploadClaims, secret: string) {
  const payload = b64url(JSON.stringify(claims));
  return `${payload}.${b64url(sign(payload, secret))}`;
}

export function verifyUploadToken(
  token: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): UploadClaims | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  const expected = sign(payload, secret);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as UploadClaims;
    if (typeof claims.exp !== "number" || claims.exp < now) return null;
    return claims;
  } catch {
    return null;
  }
}
