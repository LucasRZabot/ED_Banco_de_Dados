import { describe, expect, it } from "vitest";
import { isSafeFileKey, sanitizeOriginalName, sniffedMime } from "@/lib/upload-guard";

describe("sanitizeOriginalName", () => {
  it("descarta caminho e caracteres de travessia", () => {
    expect(sanitizeOriginalName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeOriginalName("C:\\\\temp\\\\nota.pdf")).toBe("nota.pdf");
    expect(sanitizeOriginalName("..\\..\\secret.xml")).toBe("secret.xml");
  });
});

describe("sniffedMime", () => {
  it("aceita PDF, XML, PNG e JPEG reais", () => {
    expect(sniffedMime(Buffer.from("%PDF-1.4\n"), "application/pdf")).toBe("application/pdf");
    expect(sniffedMime(Buffer.from("<?xml version='1.0'?><nfe/>"), "text/xml")).toBe("text/xml");
    expect(sniffedMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png")).toBe("image/png");
    expect(sniffedMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg")).toBe("image/jpeg");
  });

  it("recusa HTML ou executável disfarçado", () => {
    expect(sniffedMime(Buffer.from("<html><script>"), "text/xml")).toBeNull();
    expect(sniffedMime(Buffer.from("MZ"), "application/pdf")).toBeNull();
  });
});

describe("isSafeFileKey", () => {
  it("rejeita travessia de diretório", () => {
    expect(isSafeFileKey("notas-fiscais/2026/11/../../contratos/x.pdf", "INVOICE_PDF")).toBe(false);
    expect(isSafeFileKey("/etc/passwd", "TICKET")).toBe(false);
  });
});
