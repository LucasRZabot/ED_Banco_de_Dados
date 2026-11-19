import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDashboardSnapshot } from "@/features/dashboard/queries";
import type { CurrentUser } from "@/lib/dal";
import { addDays, todayInTz } from "@/lib/dates";
import { db } from "@/lib/db";
import { cnpjFromBase } from "@/lib/validators/cnpj";
import { buildBankDigitableLine } from "@/lib/validators/digitable-line";

const run = randomUUID().slice(0, 8);
const stamp = Date.now().toString().slice(-10);
const today = todayInTz();

let sectorA: string;
let sectorB: string;
let admin: CurrentUser;
let financeiro: CurrentUser;
let chefia: CurrentUser;
let supplierA: string;
let supplierB: string;
let billTodayA: string;
let billOverdueB: string;
let invoicePendingA: string;
let ticketA: string;
let quoteA: string;
let contractA: string;

async function makeUser(role: CurrentUser["role"], sectorId: string): Promise<CurrentUser> {
  const u = await db.user.create({
    data: {
      email: `${role.toLowerCase()}-dash-${run}@teste.local`,
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
  sectorA = (await db.sector.create({ data: { name: `UTI Dash ${run}`, costCenter: `DA-${run}` } })).id;
  sectorB = (await db.sector.create({ data: { name: `CC Dash ${run}`, costCenter: `DB-${run}` } })).id;
  admin = await makeUser("ADMIN", sectorA);
  financeiro = await makeUser("FINANCEIRO", sectorA);
  chefia = await makeUser("REQUESTER", sectorA);
  supplierA = (
    await db.supplier.create({
      data: { legalName: `Fornecedor Dash A ${run}`, cnpj: cnpjFromBase(`21${stamp}`.slice(0, 12)) },
    })
  ).id;
  supplierB = (
    await db.supplier.create({
      data: { legalName: `Fornecedor Dash B ${run}`, cnpj: cnpjFromBase(`22${stamp}`.slice(0, 12)) },
    })
  ).id;

  billTodayA = (
    await db.bill.create({
      data: {
        supplierId: supplierA,
        sectorId: sectorA,
        createdById: financeiro.id,
        amount: "150.00",
        digitableLine: line(1),
        dueDate: today,
        description: `Boleto hoje ${run}`,
      },
    })
  ).id;
  await db.bill.create({
    data: {
      supplierId: supplierA,
      sectorId: sectorA,
      createdById: financeiro.id,
      amount: "80.00",
      digitableLine: line(2),
      dueDate: addDays(today, -4),
      description: `Boleto atrasado A ${run}`,
    },
  });
  billOverdueB = (
    await db.bill.create({
      data: {
        supplierId: supplierB,
        sectorId: sectorB,
        createdById: financeiro.id,
        amount: "90.00",
        digitableLine: line(3),
        dueDate: addDays(today, -2),
        description: `Boleto atrasado B ${run}`,
      },
    })
  ).id;
  await db.bill.create({
    data: {
      supplierId: supplierA,
      sectorId: sectorA,
      createdById: financeiro.id,
      amount: "40.00",
      digitableLine: line(4),
      dueDate: addDays(today, -20),
      status: "PAID",
      paidAt: today,
      paidAmount: "40.00",
      paidById: financeiro.id,
      description: `Boleto pago ${run}`,
    },
  });

  invoicePendingA = (
    await db.invoice.create({
      data: {
        description: `NF pendente ${run}`,
        sectorId: sectorA,
        supplierId: supplierA,
        submittedById: chefia.id,
        amount: "200.00",
      },
    })
  ).id;
  await db.invoice.create({
    data: {
      description: `NF lançada ${run}`,
      sectorId: sectorA,
      supplierId: supplierA,
      submittedById: chefia.id,
      amount: "300.00",
      number: `9${run}`,
      series: "1",
      issueDate: today,
      status: "POSTED",
      postedAt: today,
      postedById: financeiro.id,
    },
  });

  ticketA = (
    await db.ticket.create({
      data: {
        type: "PURCHASE_QUOTE",
        title: `Compra dash ${run}`,
        description: "Pedido de material para o dashboard.",
        justification: "Cobertura do card de chamados pendentes.",
        urgency: "CRITICAL",
        sectorId: sectorA,
        requesterId: chefia.id,
      },
    })
  ).id;
  await db.ticket.create({
    data: {
      type: "CONTRACT_INCLUSION",
      title: `Contrato dash B ${run}`,
      description: "Chamado de outro setor para o filtro.",
      justification: "Não deve entrar no recorte do setor A.",
      sectorId: sectorB,
      requesterId: chefia.id,
    },
  });

  quoteA = (
    await db.quote.create({
      data: {
        supplierId: supplierA,
        ticketId: ticketA,
        amount: "500.00",
        validUntil: addDays(today, 10),
        description: `Orçamento dash ${run}`,
        createdById: financeiro.id,
      },
    })
  ).id;

  contractA = (
    await db.contract.create({
      data: {
        object: `Contrato dash ${run}`,
        supplierId: supplierA,
        sectorId: sectorA,
        monthlyValue: "1200.00",
        startDate: addDays(today, -40),
        endDate: addDays(today, 12),
        alertDaysBefore: 30,
        createdById: financeiro.id,
      },
    })
  ).id;

  await db.notification.create({
    data: {
      userId: financeiro.id,
      type: "BILL_DUE_TODAY",
      severity: "CRITICAL",
      title: `Boleto vence hoje ${run}`,
      message: "Há boleto com vencimento hoje.",
      link: `/boletos/${billTodayA}`,
      billId: billTodayA,
      dedupeKey: `dash:${run}:today`,
    },
  });
});

afterAll(async () => {
  const userIds = [admin?.id, financeiro?.id, chefia?.id].filter(Boolean);
  await db.notification.deleteMany({ where: { userId: { in: userIds } } });
  if (quoteA) await db.quote.deleteMany({ where: { id: quoteA } });
  if (contractA) await db.contract.deleteMany({ where: { id: contractA } });
  await db.bill.deleteMany({ where: { createdById: { in: userIds } } });
  await db.invoice.deleteMany({ where: { submittedById: { in: userIds } } });
  await db.ticket.deleteMany({ where: { requesterId: { in: userIds } } });
  if (supplierA) await db.supplier.deleteMany({ where: { id: supplierA } });
  if (supplierB) await db.supplier.deleteMany({ where: { id: supplierB } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.sector.deleteMany({ where: { id: { in: [sectorA, sectorB] } } });
  await db.$disconnect();
});

describe("dashboard da coordenadora", () => {
  it("conta boletos, NFs pendentes, chamados, orçamentos e contratos", async () => {
    const snap = await getDashboardSnapshot();
    expect(snap.dueToday._count).toBeGreaterThanOrEqual(1);
    expect(snap.overdue._count).toBeGreaterThanOrEqual(2);
    expect(snap.pendingInvoices).toBeGreaterThanOrEqual(1);
    expect(snap.postedThisMonth).toBeGreaterThanOrEqual(1);
    expect(snap.pendingTickets).toBeGreaterThanOrEqual(2);
    expect(snap.criticalTickets).toBeGreaterThanOrEqual(1);
    expect(snap.pendingQuotes).toBeGreaterThanOrEqual(1);
    expect(snap.expiringContractItems.some((c) => c.id === contractA)).toBe(true);
    expect(snap.alertBills.some((b) => b.id === billTodayA)).toBe(true);
    expect(snap.pendingInvoiceItems.some((n) => n.id === invoicePendingA)).toBe(true);
  });

  it("aplica fornecedor, setor e período às listas relevantes", async () => {
    const bySector = await getDashboardSnapshot({ sectorId: sectorA });
    expect(bySector.alertBills.some((b) => b.id === billOverdueB)).toBe(false);
    expect(bySector.alertBills.some((b) => b.id === billTodayA)).toBe(true);
    expect(bySector.pendingTicketItems.every((t) => t.sector.costCenter.startsWith("DA-"))).toBe(true);

    const bySupplier = await getDashboardSnapshot({ supplierId: supplierB });
    expect(bySupplier.alertBills.every((b) => b.id !== billTodayA)).toBe(true);
    expect(bySupplier.pendingInvoiceItems.every((n) => n.id !== invoicePendingA)).toBe(true);

    const future = await getDashboardSnapshot({ from: "2099-01-01", to: "2099-01-31" });
    expect(future.dueToday._count).toBe(0);
    expect(future.overdue._count).toBe(0);
    expect(future.alertBills).toEqual([]);
  });

  it("filtro de status restringe a lista de boletos urgentes", async () => {
    const overdue = await getDashboardSnapshot({ status: "BILL_OVERDUE" });
    expect(overdue.alertBills.every((b) => b.dueDate < today)).toBe(true);
    const toPay = await getDashboardSnapshot({ status: "BILL_TO_PAY" });
    expect(toPay.alertBills.every((b) => b.dueDate >= today)).toBe(true);
  });
});
