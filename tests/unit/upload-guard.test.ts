import { describe, expect, it } from "vitest";
import { isSafeFileKey, sanitizeOriginalName, sniffedMime, stripUnsafeXml } from "@/lib/upload-guard";

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

  it("recusa HTML, XHTML, SVG ou executável disfarçado", () => {
    expect(sniffedMime(Buffer.from("<html><script>"), "text/xml")).toBeNull();
    expect(sniffedMime(Buffer.from("<nfe/>"), "text/xml")).toBeNull();
    expect(
      sniffedMime(
        Buffer.from('<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></html>'),
        "text/xml",
      ),
    ).toBeNull();
    expect(sniffedMime(Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>'), "text/xml")).toBeNull();
    expect(sniffedMime(Buffer.from("MZ"), "application/pdf")).toBeNull();
  });
});

describe("stripUnsafeXml", () => {
  it("remove script e javascript: de NF-e", () => {
    const raw = Buffer.from(
      '<?xml version="1.0"?><nfeProc><infNFe onclick="javascript:alert(1)"/><script>x</script></nfeProc>',
    );
    const out = stripUnsafeXml(raw);
    expect(out).toBeTruthy();
    const text = out!.toString("utf8").toLowerCase();
    expect(text).toContain("<?xml");
    expect(text).not.toContain("<script");
    expect(text).not.toContain("javascript:");
    expect(text).not.toContain("onclick");
  });

  it("recusa XHTML mesmo com declaração XML", () => {
    expect(
      stripUnsafeXml(Buffer.from('<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><b>x</b></html>')),
    ).toBeNull();
  });
});

describe("isSafeFileKey", () => {
  it("rejeita travessia de diretório", () => {
    expect(isSafeFileKey("notas-fiscais/2026/11/../../contratos/x.pdf", "INVOICE_PDF")).toBe(false);
    expect(isSafeFileKey("/etc/passwd", "TICKET")).toBe(false);
  });
});
