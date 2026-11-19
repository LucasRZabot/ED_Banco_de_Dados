import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { addDays, startOfMonth, startOfNextMonth, todayInTz, toDateInputValue } from "@/lib/dates";
import { db } from "@/lib/db";
import { dateOnlyBound, rangeIsImpossible, tightenDateFilter, ymdInRange } from "./filters";
import type { DashboardFilters } from "./schemas";

const unpaid: Prisma.EnumBillStatusFilter = { not: "PAID" };
const pendingTickets: Prisma.EnumTicketStatusFilter = { in: ["OPEN", "IN_PROGRESS"] };

const emptyAgg = { _count: 0, _sum: { amount: null as Prisma.Decimal | null, paidAmount: null as Prisma.Decimal | null } };

function scopeIds(filters: DashboardFilters) {
  return { supplierId: filters.supplierId, sectorId: filters.sectorId };
}

function periodCreatedAt(filters: DashboardFilters): Prisma.DateTimeFilter | undefined {
  if (!filters.from && !filters.to) return undefined;
  return {
    gte: dateOnlyBound(filters.from, false),
    lte: dateOnlyBound(filters.to, true),
  };
}

export async function getDashboardSnapshot(filters: DashboardFilters = {}) {
  const today = todayInTz();
  const todayYmd = toDateInputValue(today);
  const in7 = addDays(today, 7);
  const monthStart = startOfMonth(today);
  const nextMonth = startOfNextMonth(today);
  const in30 = addDays(today, 30);
  const { supplierId, sectorId } = scopeIds(filters);
  const createdAt = periodCreatedAt(filters);
  const todayInPeriod = ymdInRange(todayYmd, filters.from, filters.to);

  const dueSoonBounds = tightenDateFilter({ gt: today, lte: in7 }, filters.from, filters.to);
  const overdueBounds = tightenDateFilter({ lt: today }, filters.from, filters.to);
  const paidBounds = filters.from || filters.to
    ? tightenDateFilter({}, filters.from, filters.to)
    : { gte: monthStart, lt: nextMonth };
  const postedBounds = paidBounds;
  const contractWindow = filters.from || filters.to
    ? tightenDateFilter({}, filters.from, filters.to)
    : { lte: in30 };
  const quoteBounds = tightenDateFilter({}, filters.from, filters.to);

  const skipDueToday = !todayInPeriod;
  const skipDueSoon = rangeIsImpossible(dueSoonBounds);
  const skipOverdue = rangeIsImpossible(overdueBounds);
  const skipAlerts = skipDueToday && skipDueSoon && skipOverdue;

  const billScope: Prisma.BillWhereInput = { supplierId, sectorId };
  const invoiceScope: Prisma.InvoiceWhereInput = { supplierId, sectorId };
  const ticketScope: Prisma.TicketWhereInput = { sectorId, createdAt };
  const quoteScope: Prisma.QuoteWhereInput = {
    supplierId,
    ticket: sectorId ? { sectorId } : undefined,
    validUntil: filters.from || filters.to ? quoteBounds : undefined,
  };
  const contractScope: Prisma.ContractWhereInput = { supplierId, sectorId };

  const [
    dueToday,
    dueSoon,
    overdue,
    paidThisMonth,
    ticketGroups,
    pendingInvoiceAgg,
    postedMonth,
    pendingQuotesAgg,
    expiringContracts,
    alertBills,
    pendingInvoices,
    pendingTicketItems,
    pendingQuotes,
    paidBills,
  ] = await Promise.all([
    skipDueToday
      ? emptyAgg
      : db.bill.aggregate({
          where: { ...billScope, status: unpaid, dueDate: today },
          _count: true,
          _sum: { amount: true },
        }),
    skipDueSoon
      ? emptyAgg
      : db.bill.aggregate({
          where: { ...billScope, status: unpaid, dueDate: dueSoonBounds },
          _count: true,
          _sum: { amount: true },
        }),
    skipOverdue
      ? emptyAgg
      : db.bill.aggregate({
          where: { ...billScope, status: unpaid, dueDate: overdueBounds },
          _count: true,
          _sum: { amount: true },
        }),
    db.bill.aggregate({
      where: { ...billScope, status: "PAID", paidAt: paidBounds },
      _count: true,
      _sum: { paidAmount: true },
    }),
    db.ticket.groupBy({
      by: ["status", "urgency"],
      where: { ...ticketScope, status: pendingTickets },
      _count: true,
    }),
    db.invoice.aggregate({
      where: {
        ...invoiceScope,
        status: "PENDING",
        ...(createdAt
          ? { OR: [{ issueDate: createdAt }, { issueDate: null, createdAt }] }
          : {}),
      },
      _count: true,
      _sum: { amount: true },
    }),
    db.invoice.aggregate({
      where: { ...invoiceScope, status: "POSTED", postedAt: postedBounds },
      _count: true,
      _sum: { amount: true },
    }),
    db.quote.aggregate({
      where: { ...quoteScope, status: "PENDING" },
      _count: true,
      _sum: { amount: true },
    }),
    db.contract.findMany({
      where: {
        ...contractScope,
        status: "ACTIVE",
        OR: [{ endDate: contractWindow }, { renewalDate: contractWindow }],
      },
      orderBy: [{ endDate: "asc" }, { renewalDate: "asc" }],
      take: 8,
      select: {
        id: true,
        object: true,
        endDate: true,
        renewalDate: true,
        monthlyValue: true,
        supplier: { select: { legalName: true } },
        sector: { select: { name: true, costCenter: true } },
      },
    }),
    skipAlerts
      ? []
      : db.bill.findMany({
      where: {
        ...billScope,
        status: unpaid,
        dueDate: tightenDateFilter({ lte: in7 }, filters.from, filters.to),
      },
      orderBy: { dueDate: "asc" },
      take: 12,
      select: {
        id: true,
        amount: true,
        dueDate: true,
        status: true,
        description: true,
        supplier: { select: { legalName: true } },
        sector: { select: { name: true, costCenter: true } },
      },
    }),
    db.invoice.findMany({
      where: {
        ...invoiceScope,
        status: "PENDING",
        ...(createdAt
          ? { OR: [{ issueDate: createdAt }, { issueDate: null, createdAt }] }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        description: true,
        amount: true,
        issueDate: true,
        createdAt: true,
        supplier: { select: { legalName: true } },
        sector: { select: { name: true, costCenter: true } },
      },
    }),
    db.ticket.findMany({
      where: { ...ticketScope, status: pendingTickets },
      orderBy: [{ createdAt: "desc" }],
      take: 8,
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        urgency: true,
        createdAt: true,
        neededBy: true,
        sector: { select: { name: true, costCenter: true } },
      },
    }),
    db.quote.findMany({
      where: { ...quoteScope, status: "PENDING" },
      orderBy: [{ validUntil: "asc" }],
      take: 8,
      select: {
        id: true,
        amount: true,
        validUntil: true,
        description: true,
        supplier: { select: { legalName: true } },
        ticket: { select: { title: true, sector: { select: { name: true, costCenter: true } } } },
      },
    }),
    db.bill.findMany({
      where: { ...billScope, status: "PAID", paidAt: paidBounds },
      orderBy: { paidAt: "desc" },
      take: 8,
      select: {
        id: true,
        amount: true,
        dueDate: true,
        paidAmount: true,
        paidAt: true,
        description: true,
        supplier: { select: { legalName: true } },
        sector: { select: { name: true, costCenter: true } },
      },
    }),
  ]);

  const openTickets = ticketGroups.filter((g) => g.status === "OPEN").reduce((n, g) => n + g._count, 0);
  const inProgressTickets = ticketGroups.filter((g) => g.status === "IN_PROGRESS").reduce((n, g) => n + g._count, 0);
  const criticalTickets = ticketGroups.filter((g) => g.urgency === "CRITICAL").reduce((n, g) => n + g._count, 0);
  const highTickets = ticketGroups.filter((g) => g.urgency === "HIGH").reduce((n, g) => n + g._count, 0);

  const alertBillsFiltered =
    filters.status === "BILL_OVERDUE"
      ? alertBills.filter((b) => b.dueDate < today)
      : filters.status === "BILL_TO_PAY"
        ? alertBills.filter((b) => b.dueDate >= today)
        : filters.status === "BILL_PAID"
          ? []
          : alertBills;

  return {
    today,
    dueToday,
    dueSoon,
    overdue,
    paidThisMonth,
    pendingTickets: openTickets + inProgressTickets,
    openTickets,
    inProgressTickets,
    criticalTickets,
    highTickets,
    pendingInvoices: pendingInvoiceAgg._count,
    pendingInvoiceAmount: pendingInvoiceAgg._sum.amount,
    postedThisMonth: postedMonth._count,
    postedThisMonthAmount: postedMonth._sum.amount,
    pendingQuotes: pendingQuotesAgg._count,
    pendingQuoteAmount: pendingQuotesAgg._sum.amount,
    expiringContracts: expiringContracts.length,
    expiringContractItems: expiringContracts,
    alertBills: alertBillsFiltered,
    pendingInvoiceItems: pendingInvoices,
    pendingTicketItems,
    pendingQuoteItems: pendingQuotes,
    paidBillItems: paidBills,
  };
}
