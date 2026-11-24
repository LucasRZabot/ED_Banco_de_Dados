import { describe, expect, it } from "vitest";
import { contentDisposition } from "@/lib/content-disposition";

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
});
