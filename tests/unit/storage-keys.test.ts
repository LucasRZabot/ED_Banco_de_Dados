import { describe, expect, it } from "vitest";
import { buildFileKey, canUploadCategory, isAllowedMime, keyMatchesCategory } from "@/lib/storage-keys";

const TZ = "America/Sao_Paulo";
const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("buildFileKey", () => {
  it("usa prefixo datado para notas fiscais", () => {
    const key = buildFileKey({
      category: "INVOICE_PDF",
      mimeType: "application/pdf",
      referenceDate: new Date("2026-11-19T12:00:00Z"),
      timeZone: TZ,
      id: ID,
    });
    expect(key).toBe(`notas-fiscais/2026/11/${ID}.pdf`);
  });

  it("calcula o mês no fuso do hospital, não em UTC", () => {
    // 01/12 01:00 UTC ainda é 30/11 em São Paulo
    const key = buildFileKey({
      category: "BILL",
      mimeType: "application/pdf",
      referenceDate: new Date("2026-12-01T01:00:00Z"),
      timeZone: TZ,
      id: ID,
    });
    expect(key).toBe(`boletos/2026/11/${ID}.pdf`);
  });

  it("marca comprovantes de pagamento", () => {
    const key = buildFileKey({ category: "BILL_PAYMENT_PROOF", mimeType: "image/jpeg", timeZone: TZ, id: ID });
    expect(key).toMatch(new RegExp(`^boletos/\\d{4}/\\d{2}/${ID}-comprovante\\.jpg$`));
  });

  it("usa prefixos fixos para chamados, orçamentos e contratos", () => {
    expect(buildFileKey({ category: "TICKET", mimeType: "image/png", timeZone: TZ, id: ID })).toBe(`chamados/${ID}.png`);
    expect(buildFileKey({ category: "QUOTE", mimeType: "application/pdf", timeZone: TZ, id: ID })).toBe(`orcamentos/${ID}.pdf`);
    expect(buildFileKey({ category: "CONTRACT", mimeType: "application/pdf", timeZone: TZ, id: ID })).toBe(`contratos/${ID}.pdf`);
  });

  it("rejeita tipos não suportados", () => {
    expect(() => buildFileKey({ category: "TICKET", mimeType: "application/x-msdownload", timeZone: TZ })).toThrow();
  });

  it("gera keys que passam na validação da própria categoria", () => {
    const key = buildFileKey({ category: "INVOICE_XML", mimeType: "text/xml", timeZone: TZ });
    expect(keyMatchesCategory(key, "INVOICE_XML")).toBe(true);
    expect(keyMatchesCategory(key, "CONTRACT")).toBe(false);
    expect(keyMatchesCategory(`notas-fiscais/2026/11/../../contratos/${ID}.pdf`, "INVOICE_PDF")).toBe(false);
  });
});

describe("políticas de upload", () => {
  it("separa o que cada perfil pode anexar", () => {
    expect(canUploadCategory("REQUESTER", "TICKET")).toBe(true);
    expect(canUploadCategory("REQUESTER", "INVOICE_PDF")).toBe(true);
    expect(canUploadCategory("REQUESTER", "INVOICE_XML")).toBe(true);
    expect(canUploadCategory("REQUESTER", "BILL")).toBe(false);
    expect(canUploadCategory("REQUESTER", "QUOTE")).toBe(false);
    expect(canUploadCategory("FINANCEIRO", "QUOTE")).toBe(true);
    expect(canUploadCategory("FINANCEIRO", "CONTRACT")).toBe(true);
    expect(canUploadCategory("ADMIN", "QUOTE")).toBe(false);
    expect(canUploadCategory("ADMIN", "INVOICE_PDF")).toBe(false);
    expect(canUploadCategory("ADMIN", "TICKET")).toBe(false);
  });

  it("restringe MIME por categoria", () => {
    expect(isAllowedMime("INVOICE_XML", "application/xml")).toBe(true);
    expect(isAllowedMime("INVOICE_PDF", "image/png")).toBe(false);
    expect(isAllowedMime("CONTRACT", "application/pdf")).toBe(true);
    expect(isAllowedMime("BILL", "application/pdf")).toBe(true);
    expect(isAllowedMime("BILL", "image/png")).toBe(false);
    expect(isAllowedMime("BILL_PAYMENT_PROOF", "image/png")).toBe(true);
  });
});
