import { describe, expect, it } from "vitest";
import { createUploadToken, verifyUploadToken, type UploadClaims } from "@/lib/upload-token";

const SECRET = "s".repeat(40);
const claims: UploadClaims = {
  key: "chamados/0f8fad5b-d9cb-469f-a165-70867728950e.pdf",
  userId: "user_1",
  category: "TICKET",
  fileName: "orçamento.pdf",
  fileType: "application/pdf",
  fileSize: 1234,
  exp: 2_000_000_000,
};

describe("upload token", () => {
  it("valida um token íntegro", () => {
    const token = createUploadToken(claims, SECRET);
    expect(verifyUploadToken(token, SECRET, 1_900_000_000)).toEqual(claims);
  });

  it("rejeita token expirado", () => {
    const token = createUploadToken(claims, SECRET);
    expect(verifyUploadToken(token, SECRET, 2_000_000_001)).toBeNull();
  });

  it("rejeita payload adulterado", () => {
    const [, sig] = createUploadToken(claims, SECRET).split(".");
    const forged = Buffer.from(JSON.stringify({ ...claims, userId: "outro" })).toString("base64url");
    expect(verifyUploadToken(`${forged}.${sig}`, SECRET, 1_900_000_000)).toBeNull();
  });

  it("rejeita assinatura com outro segredo e formatos inválidos", () => {
    const token = createUploadToken(claims, SECRET);
    expect(verifyUploadToken(token, "x".repeat(40), 1_900_000_000)).toBeNull();
    expect(verifyUploadToken("abc", SECRET)).toBeNull();
    expect(verifyUploadToken(`${token}.extra`, SECRET)).toBeNull();
  });
});
