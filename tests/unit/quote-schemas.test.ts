import { describe, expect, it } from "vitest";
import { createQuoteSchema, decideQuoteSchema } from "@/features/quotes/schemas";

describe("createQuoteSchema", () => {
  it("exige valor positivo, validade e fornecedor", () => {
    const ok = createQuoteSchema.safeParse({
      amount: "1.234,56",
      validUntil: "2026-12-20",
      supplierId: "sup_1",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.amount).toBe(1234.56);

    const bad = createQuoteSchema.safeParse({
      amount: "0",
      validUntil: "2026-12-20",
      supplierLegalName: "ACME",
      supplierCnpj: "00.000.000/0000-00",
    });
    expect(bad.success).toBe(false);
  });
});

describe("decideQuoteSchema", () => {
  it("reprovação exige nota; aprovação pode reprovar os demais", () => {
    const reject = decideQuoteSchema.safeParse({
      quoteId: "q1",
      decision: "REJECTED",
      decisionNote: "  ",
    });
    expect(reject.success).toBe(false);

    const approve = decideQuoteSchema.safeParse({
      quoteId: "q1",
      decision: "APPROVED",
      rejectSiblings: "1",
    });
    expect(approve.success).toBe(true);
    if (approve.success) expect(approve.data.rejectSiblings).toBe(true);
  });
});
