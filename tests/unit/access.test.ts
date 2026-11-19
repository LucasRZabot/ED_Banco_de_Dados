import { describe, expect, it } from "vitest";
import { canViewBill, canViewOwnSubmission } from "@/lib/access";

describe("visibilidade da chefia", () => {
  it("financeiro vê qualquer envio e a chefia só o próprio", () => {
    expect(canViewOwnSubmission({ id: "chefia", role: "FINANCEIRO" }, "outra")).toBe(true);
    expect(canViewOwnSubmission({ id: "chefia", role: "REQUESTER" }, "chefia")).toBe(true);
    expect(canViewOwnSubmission({ id: "chefia", role: "REQUESTER" }, "colega-do-mesmo-setor")).toBe(false);
    expect(canViewOwnSubmission({ id: "ti", role: "ADMIN" }, "ti")).toBe(false);
  });

  it("só o financeiro vê boletos", () => {
    expect(canViewBill({ id: "fin", role: "FINANCEIRO" })).toBe(true);
    expect(canViewBill({ id: "chefia", role: "REQUESTER" })).toBe(false);
    expect(canViewBill({ id: "ti", role: "ADMIN" })).toBe(false);
  });
});
