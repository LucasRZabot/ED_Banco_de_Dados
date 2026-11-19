import { describe, expect, it } from "vitest";
import { createContractSchema } from "@/features/contracts/schemas";

describe("createContractSchema", () => {
  it("exige objeto, início, setor e um dos valores", () => {
    const ok = createContractSchema.safeParse({
      object: "Manutenção preventiva de bombas",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      monthlyValue: "1.200,00",
      sectorId: "sec_1",
      supplierId: "sup_1",
      alertDaysBefore: "30",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.monthlyValue).toBe(1200);

    const missingValue = createContractSchema.safeParse({
      object: "Manutenção preventiva de bombas",
      startDate: "2026-01-01",
      sectorId: "sec_1",
      supplierId: "sup_1",
    });
    expect(missingValue.success).toBe(false);
  });

  it("rejeita término anterior ao início", () => {
    const bad = createContractSchema.safeParse({
      object: "Manutenção preventiva de bombas",
      startDate: "2026-12-01",
      endDate: "2026-01-01",
      totalValue: "10.000,00",
      sectorId: "sec_1",
      supplierId: "sup_1",
    });
    expect(bad.success).toBe(false);
  });
});
