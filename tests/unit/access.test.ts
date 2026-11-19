import { describe, expect, it } from "vitest";
import { canViewBill, canViewContract, canViewDashboard, canViewInvoice, canViewOwnSubmission, canViewQuote } from "@/lib/access";
import { canAccessPath } from "@/lib/roles";

describe("visibilidade da chefia", () => {
  it("financeiro vê qualquer envio e a chefia só o próprio", () => {
    expect(canViewOwnSubmission({ id: "chefia", role: "FINANCEIRO" }, "outra")).toBe(true);
    expect(canViewOwnSubmission({ id: "chefia", role: "REQUESTER" }, "chefia")).toBe(true);
    expect(canViewOwnSubmission({ id: "chefia", role: "REQUESTER" }, "colega-do-mesmo-setor")).toBe(false);
    expect(canViewOwnSubmission({ id: "ti", role: "ADMIN" }, "ti")).toBe(false);
  });

  it("nota fiscal segue a visibilidade por autor", () => {
    expect(canViewInvoice({ id: "chefia", role: "REQUESTER" }, "chefia")).toBe(true);
    expect(canViewInvoice({ id: "chefia", role: "REQUESTER" }, "colega")).toBe(false);
    expect(canViewInvoice({ id: "fin", role: "FINANCEIRO" }, "chefia")).toBe(true);
    expect(canViewInvoice({ id: "ti", role: "ADMIN" }, "chefia")).toBe(false);
  });

  it("só o financeiro vê boletos", () => {
    expect(canViewBill({ id: "fin", role: "FINANCEIRO" })).toBe(true);
    expect(canViewBill({ id: "chefia", role: "REQUESTER" })).toBe(false);
    expect(canViewBill({ id: "ti", role: "ADMIN" })).toBe(false);
  });

  it("só o financeiro vê orçamentos", () => {
    expect(canViewQuote({ id: "fin", role: "FINANCEIRO" })).toBe(true);
    expect(canViewQuote({ id: "chefia", role: "REQUESTER" })).toBe(false);
    expect(canViewQuote({ id: "ti", role: "ADMIN" })).toBe(false);
  });

  it("só o financeiro vê contratos", () => {
    expect(canViewContract({ id: "fin", role: "FINANCEIRO" })).toBe(true);
    expect(canViewContract({ id: "chefia", role: "REQUESTER" })).toBe(false);
    expect(canViewContract({ id: "ti", role: "ADMIN" })).toBe(false);
  });

  it("só o financeiro vê o dashboard financeiro", () => {
    expect(canViewDashboard({ id: "fin", role: "FINANCEIRO" })).toBe(true);
    expect(canViewDashboard({ id: "chefia", role: "REQUESTER" })).toBe(false);
    expect(canViewDashboard({ id: "ti", role: "ADMIN" })).toBe(false);
    expect(canAccessPath("FINANCEIRO", "/dashboard")).toBe(true);
    expect(canAccessPath("REQUESTER", "/dashboard")).toBe(false);
    expect(canAccessPath("ADMIN", "/dashboard")).toBe(false);
  });
});
