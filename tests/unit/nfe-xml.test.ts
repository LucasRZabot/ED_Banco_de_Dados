import { describe, expect, it } from "vitest";
import { parseNfeXml } from "@/lib/nfe-xml";
import { cnpjFromBase } from "@/lib/validators/cnpj";

const cnpj = cnpjFromBase("112223330001");
const key = "35240111222333000123550010000001231234567890";

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe${key}">
      <ide>
        <serie>1</serie>
        <nNF>123</nNF>
        <dhEmi>2026-11-10T09:00:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>${cnpj}</CNPJ>
        <xNome>Hospitalar Distribuidora Ltda</xNome>
      </emit>
      <total>
        <ICMSTot>
          <vNF>150.40</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe><infProt><chNFe>${key}</chNFe></infProt></protNFe>
</nfeProc>`;

describe("parseNfeXml", () => {
  it("lê número, série, chave, emissão, valor e emitente", () => {
    const parsed = parseNfeXml(xml);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data).toMatchObject({
      accessKey: key,
      number: "123",
      series: "1",
      issueDate: "2026-11-10",
      amount: "150.40",
      supplierCnpj: cnpj,
      supplierLegalName: "Hospitalar Distribuidora Ltda",
    });
  });

  it("recusa arquivo que não é XML de NF-e", () => {
    expect(parseNfeXml("nota.pdf").ok).toBe(false);
    expect(parseNfeXml("<root/>").ok).toBe(false);
  });
});
