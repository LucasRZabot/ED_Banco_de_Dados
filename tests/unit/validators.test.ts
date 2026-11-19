import { describe, expect, it } from "vitest";
import { cnpjFromBase, isValidCnpj } from "@/lib/validators/cnpj";
import {
  buildBankDigitableLine,
  buildConvenioDigitableLine,
  validateDigitableLine,
} from "@/lib/validators/digitable-line";

describe("CNPJ", () => {
  it("aceita CNPJ com DV correto e rejeita repetição", () => {
    const cnpj = cnpjFromBase("112223330001");
    expect(cnpj).toHaveLength(14);
    expect(isValidCnpj(cnpj)).toBe(true);
    expect(isValidCnpj(cnpj.slice(0, 13) + ((Number(cnpj[13]) + 1) % 10))).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
  });
});

describe("linha digitável", () => {
  it("valida boleto bancário 47 dígitos e rejeita DV errado", () => {
    const line = buildBankDigitableLine({ amountCents: "0000019900" });
    expect(line).toHaveLength(47);
    expect(validateDigitableLine(line)).toEqual({ ok: true, digits: line, kind: "bank" });
    expect(validateDigitableLine(line.slice(0, 10) + " " + line.slice(10)).ok).toBe(true);
    const tampered = `${line.slice(0, 9)}0${line.slice(10)}`;
    expect(validateDigitableLine(tampered).ok).toBe(false);
  });

  it("valida convênio 48 dígitos", () => {
    const line = buildConvenioDigitableLine();
    expect(line).toHaveLength(48);
    const result = validateDigitableLine(line);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.kind).toBe("convenio");
  });

  it("rejeita tamanho inválido", () => {
    expect(validateDigitableLine("123").ok).toBe(false);
  });
});
