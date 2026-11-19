import { describe, expect, it } from "vitest";
import { addDays, daysUntil, parseDateOnly, todayInTz, ymdInTz } from "@/lib/dates";
import { formatDateOnly } from "@/lib/format";
import { getDeadlineLevel } from "@/lib/deadlines";

describe("todayInTz", () => {
  it("usa o dia civil de São Paulo, não UTC", () => {
    // 19/11 02:30 UTC ainda é 18/11 em São Paulo.
    const instant = new Date("2026-11-19T02:30:00.000Z");
    expect(ymdInTz(instant, "America/Sao_Paulo")).toBe("2026-11-18");
    expect(ymdInTz(instant, "UTC")).toBe("2026-11-19");
  });
});

describe("getDeadlineLevel", () => {
  const today = parseDateOnly("2026-11-19");

  it("vermelho hoje ou atrasado, amarelo até 5 dias, verde depois", () => {
    expect(getDeadlineLevel(parseDateOnly("2026-11-18"), { today })).toBe("danger");
    expect(getDeadlineLevel(today, { today })).toBe("danger");
    expect(getDeadlineLevel(addDays(today, 1), { today })).toBe("warning");
    expect(getDeadlineLevel(addDays(today, 5), { today })).toBe("warning");
    expect(getDeadlineLevel(addDays(today, 6), { today })).toBe("ok");
  });

  it("pago ignora a data", () => {
    expect(getDeadlineLevel(parseDateOnly("2026-01-01"), { today, paid: true })).toBe("paid");
  });

  it("daysUntil conta no calendário UTC das colunas Date", () => {
    expect(daysUntil(parseDateOnly("2026-11-24"), today)).toBe(5);
    expect(daysUntil(parseDateOnly("2026-11-18"), today)).toBe(-1);
  });
});

describe("todayInTz default", () => {
  it("devolve meia-noite UTC do dia de São Paulo", () => {
    const t = todayInTz();
    expect(t.toISOString().endsWith("T00:00:00.000Z")).toBe(true);
  });
});

describe("formatDateOnly", () => {
  it("não recua o dia ao formatar Date UTC de coluna @db.Date", () => {
    expect(formatDateOnly(parseDateOnly("2026-11-21"))).toBe("21/11/2026");
  });
});
