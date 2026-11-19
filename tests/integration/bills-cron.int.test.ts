import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/cron/check-deadlines/route";
import { effectiveBillStatus, getBillOrNotFound, listBills } from "@/features/bills/queries";
import type { CurrentUser } from "@/lib/dal";
import { addDays, todayInTz } from "@/lib/dates";
import { db } from "@/lib/db";
import { cnpjFromBase } from "@/lib/validators/cnpj";
import { buildBankDigitableLine } from "@/lib/validators/digitable-line";
import { runCheckDeadlines } from "@/server/jobs/check-deadlines";

const run = randomUUID().slice(0, 8);
const stamp = Date.now().toString().slice(-10);
const today = todayInTz();

let sectorId: string;
let admin: CurrentUser;
let financeiro: CurrentUser;
let chefia: CurrentUser;
let supplierId: string;
let overdueId: string;
let todayId: string;
let soonId: string;
let laterId: string;
let paidId: string;
let quoteId: string;
let contractId: string;

async function makeUser(role: CurrentUser["role"], sectorId: string): Promise<CurrentUser> {
  const u = await db.user.create({
    data: {
      email: `${role.toLowerCase()}-${run}@teste.local`,
      name: role,
      role,
      sectorId,
      mustChangePassword: false,
    },
  });
  return { ...u, sector: null };
}

function line(n: number) {
  return buildBankDigitableLine({ free: `${stamp}${n}`.padEnd(25, "0") });
}

beforeAll(async () => {
  sectorId = (await db.sector.create({ data: { name: `Farmácia ${run}`, costCenter: `CC-${run}` } })).id;
  admin = await makeUser("ADMIN", sectorId);
  financeiro = await makeUser("FINANCEIRO", sectorId);
  chefia = await makeUser("REQUESTER", sectorId);
  supplierId = (
    await db.supplier.create({
      data: { legalName: `Fornecedor ${run}`, cnpj: cnpjFromBase(`88${stamp}`.slice(0, 12)) },
    })
  ).id;

  const common = { supplierId, sectorId, createdById: financeiro.id, amount: "100.00" };
  overdueId = (await db.bill.create({ data: { ...common, digitableLine: line(1), dueDate: addDays(today, -3) } })).id;
  todayId = (await db.bill.create({ data: { ...common, digitableLine: line(2), dueDate: today } })).id;
  soonId = (await db.bill.create({ data: { ...common, digitableLine: line(3), dueDate: addDays(today, 3) } })).id;
  laterId = (await db.bill.create({ data: { ...common, digitableLine: line(4), dueDate: addDays(today, 20) } })).id;
  paidId = (
    await db.bill.create({
      data: {
        ...common,
        digitableLine: line(5),
        dueDate: addDays(today, -10),
        status: "PAID",
        paidAt: addDays(today, -9),
        paidAmount: "100.00",
        paidById: financeiro.id,
      },
    })
  ).id;

  quoteId = (
    await db.quote.create({
      data: {
        supplierId,
        amount: "50.00",
        validUntil: addDays(today, 2),
        createdById: financeiro.id,
        description: `Quote ${run}`,
      },
    })
  ).id;

  contractId = (
    await db.contract.create({
      data: {
        object: `Contrato limpeza ${run}`,
        supplierId,
        sectorId,
        startDate: addDays(today, -400),
        endDate: addDays(today, -1),
        alertDaysBefore: 30,
        createdById: financeiro.id,
      },
    })
  ).id;
});

afterAll(async () => {
  const userIds = [admin?.id, financeiro?.id, chefia?.id].filter(Boolean);
  const billIds = [overdueId, todayId, soonId, laterId, paidId].filter(Boolean);
  if (billIds.length || quoteId || contractId || userIds.length) {
    await db.notification.deleteMany({
      where: {
        OR: [
          billIds.length ? { billId: { in: billIds } } : undefined,
          quoteId ? { quoteId } : undefined,
          contractId ? { contractId } : undefined,
          userIds.length ? { userId: { in: userIds } } : undefined,
        ].filter((v): v is NonNullable<typeof v> => Boolean(v)),
      },
    });
  }
  if (billIds.length) await db.bill.deleteMany({ where: { id: { in: billIds } } });
  if (quoteId) await db.quote.deleteMany({ where: { id: quoteId } });
  if (contractId) await db.contract.deleteMany({ where: { id: contractId } });
  if (supplierId) await db.supplier.deleteMany({ where: { id: supplierId } });
  if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
  if (sectorId) await db.sector.deleteMany({ where: { id: sectorId } });
  await db.$disconnect();
});

describe("visibilidade de boletos", () => {
  it("financeiro lista todos; chefia e admin não veem", async () => {
    const finance = await listBills(financeiro, {});
    const requester = await listBills(chefia, {});
    const ti = await listBills(admin, {});
    expect(finance.some((b) => b.id === overdueId)).toBe(true);
    expect(requester).toEqual([]);
    expect(ti).toEqual([]);
    await expect(getBillOrNotFound(chefia, todayId)).rejects.toThrow();
  });

  it("filtra atrasados pela data mesmo antes do cron", async () => {
    const overdue = await listBills(financeiro, { status: "OVERDUE" });
    expect(overdue.some((b) => b.id === overdueId)).toBe(true);
    expect(overdue.some((b) => b.id === paidId)).toBe(false);
    expect(overdue.some((b) => b.id === todayId)).toBe(false);
    expect(effectiveBillStatus({ status: "TO_PAY", dueDate: addDays(today, -1) }, today)).toBe("OVERDUE");
  });
});

describe("cron check-deadlines", () => {
  it("rejeita chamada sem Bearer e com Bearer errado", async () => {
    const res = await GET(new Request("http://localhost/api/cron/check-deadlines"));
    expect(res.status).toBe(401);
    const wrong = await GET(
      new Request("http://localhost/api/cron/check-deadlines", {
        headers: { authorization: "Bearer definitely-not-the-cron-secret" },
      }),
    );
    expect(wrong.status).toBe(401);
  });

  it("marca atrasados, notifica o financeiro e não duplica na segunda execução", async () => {
    const first = await runCheckDeadlines();
    expect(first.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(first.billsMarkedOverdue).toBeGreaterThanOrEqual(1);
    expect(first.contractsExpired).toBeGreaterThanOrEqual(1);

    const overdue = await db.bill.findUnique({ where: { id: overdueId } });
    const paid = await db.bill.findUnique({ where: { id: paidId } });
    const later = await db.bill.findUnique({ where: { id: laterId } });
    const contract = await db.contract.findUnique({ where: { id: contractId } });
    expect(overdue?.status).toBe("OVERDUE");
    expect(paid?.status).toBe("PAID");
    expect(later?.status).toBe("TO_PAY");
    expect(contract?.status).toBe("EXPIRED");

    const financeIds = (await db.user.findMany({ where: { role: "FINANCEIRO", active: true }, select: { id: true } })).map(
      (u) => u.id,
    );

    const overdueNotes = await db.notification.count({
      where: { billId: overdueId, type: "BILL_OVERDUE", userId: { in: financeIds } },
    });
    const todayNotes = await db.notification.count({
      where: { billId: todayId, type: "BILL_DUE_TODAY", userId: { in: financeIds } },
    });
    const soonNotes = await db.notification.count({
      where: { billId: soonId, type: "BILL_DUE_SOON", userId: { in: financeIds } },
    });
    const laterNotes = await db.notification.count({ where: { billId: laterId } });
    const paidNotes = await db.notification.count({ where: { billId: paidId } });
    const quoteNotes = await db.notification.count({ where: { quoteId } });
    const contractNotes = await db.notification.count({
      where: { contractId, type: { in: ["CONTRACT_EXPIRING", "CONTRACT_EXPIRED"] } },
    });

    expect(overdueNotes).toBe(financeIds.length);
    expect(todayNotes).toBe(financeIds.length);
    expect(soonNotes).toBe(financeIds.length);
    expect(laterNotes).toBe(0);
    expect(paidNotes).toBe(0);
    expect(quoteNotes).toBe(financeIds.length);
    expect(contractNotes).toBeGreaterThanOrEqual(financeIds.length);

    const adminNotes = await db.notification.count({
      where: { userId: admin.id, billId: { in: [overdueId, todayId, soonId] } },
    });
    expect(adminNotes).toBe(0);

    const second = await runCheckDeadlines();
    expect(second.billsMarkedOverdue).toBe(0);
    expect(second.notificationsCreated).toBe(0);
    expect(second.contractsExpired).toBe(0);

    const overdueNotesAfter = await db.notification.count({
      where: { billId: overdueId, type: "BILL_OVERDUE", userId: { in: financeIds } },
    });
    expect(overdueNotesAfter).toBe(overdueNotes);
  });

  it("aceita Bearer do CRON_SECRET", async () => {
    const res = await GET(
      new Request("http://localhost/api/cron/check-deadlines", {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.today).toBeDefined();
    expect(body.notificationsCreated).toBe(0);
  });
});
