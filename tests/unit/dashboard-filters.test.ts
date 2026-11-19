import { describe, expect, it } from "vitest";
import {
  buildDashboardCsv,
  clampYmdRange,
  csvCell,
  parseDashboardFilters,
  rangeIsImpossible,
  relevantLists,
  tightenDateFilter,
  withQuery,
  ymdInRange,
} from "@/features/dashboard/filters";

describe("filtros do dashboard", () => {
  it("ignora query inválida e lê status/fornecedor/setor/período", () => {
    expect(parseDashboardFilters({ status: "NOPE" })).toEqual({});
    expect(
      parseDashboardFilters({
        status: "INVOICE_PENDING",
        supplierId: "sup_1",
        sectorId: "sec_1",
        from: "2026-11-01",
        to: "2026-11-30",
      }),
    ).toEqual({
      status: "INVOICE_PENDING",
      supplierId: "sup_1",
      sectorId: "sec_1",
      from: "2026-11-01",
      to: "2026-11-30",
    });
  });

  it("restringe listas ao status escolhido", () => {
    expect([...relevantLists()]).toEqual(["bills", "invoices", "tickets", "quotes", "contracts"]);
    expect([...relevantLists("QUOTE_PENDING")]).toEqual(["quotes"]);
    expect([...relevantLists("BILL_OVERDUE")]).toEqual(["bills"]);
  });

  it("intersecta período com a janela do card", () => {
    expect(ymdInRange("2026-11-19", "2026-11-01", "2026-11-30")).toBe(true);
    expect(ymdInRange("2026-11-19", "2026-12-01", "2026-12-31")).toBe(false);
    expect(clampYmdRange("2026-11-20", "2026-11-26", "2026-11-22", "2026-11-30")).toEqual({
      from: "2026-11-22",
      to: "2026-11-26",
    });
    expect(clampYmdRange("2026-11-20", "2026-11-26", "2026-12-01", "2026-12-10")).toBeNull();
  });

  it("detecta recorte de datas impossível", () => {
    const bounds = tightenDateFilter(
      { gt: new Date("2026-11-19T00:00:00.000Z"), lte: new Date("2026-11-26T00:00:00.000Z") },
      "2026-12-01",
      "2026-12-10",
    );
    expect(rangeIsImpossible(bounds)).toBe(true);
  });

  it("monta query de drill-down e CSV com BOM", () => {
    expect(withQuery("/boletos", { status: "OVERDUE", supplierId: "s1", from: undefined })).toBe(
      "/boletos?status=OVERDUE&supplierId=s1",
    );
    expect(csvCell('UTI; "adulto"')).toBe('"UTI; ""adulto"""');
    const csv = buildDashboardCsv([
      {
        tipo: "boleto",
        vencimento: "19/11/2026",
        fornecedor: "Hospitalar",
        setor: "UTI (3.01.001)",
        valor: "R$ 10,00",
        status: "Atrasado",
        titulo: "Oxigênio",
      },
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("tipo;vencimento;fornecedor;setor;valor;status;titulo");
    expect(csv).toContain("boleto;19/11/2026;Hospitalar");
  });
});
