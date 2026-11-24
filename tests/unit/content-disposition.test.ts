import { describe, expect, it } from "vitest";
import { contentDisposition, fileDownloadHeaders } from "@/lib/content-disposition";

describe("contentDisposition", () => {
  it("marca inline e preserva o nome em UTF-8", () => {
    const header = contentDisposition("orçamento fornecedor.pdf", "inline");
    expect(header).toMatch(/^inline;/);
    expect(header).toContain('filename="or_amento fornecedor.pdf"');
    expect(header).toContain("filename*=UTF-8''or%C3%A7amento%20fornecedor.pdf");
  });

  it("marca attachment quando o download é forçado", () => {
    expect(contentDisposition("boleto.pdf", "attachment")).toMatch(/^attachment;/);
  });

  it("serve XML como anexo octet-stream, nunca inline/html", () => {
    const headers = fileDownloadHeaders({ fileName: "nfe.xml", fileType: "text/xml" });
    expect(headers["Content-Type"]).toBe("application/octet-stream");
    expect(headers["Content-Disposition"]).toMatch(/^attachment;/);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });
});
