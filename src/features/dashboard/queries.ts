import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { addDays, startOfMonth, startOfNextMonth, todayInTz } from "@/lib/dates";
import { db } from "@/lib/db";

const unpaid: Prisma.EnumBillStatusFilter = { not: "PAID" };

export async function getDashboardSnapshot() {
  const today = todayInTz();
  const in7 = addDays(today, 7);
  const monthStart = startOfMonth(today);
  const nextMonth = startOfNextMonth(today);
  const in30 = addDays(today, 30);

  const [
    dueToday,
    dueSoon,
    overdue,
    paidThisMonth,
    openTickets,
    inProgressTickets,
    expiringContracts,
    alertBills,
  ] = await Promise.all([
    db.bill.aggregate({
      where: { status: unpaid, dueDate: today },
      _count: true,
      _sum: { amount: true },
    }),
    db.bill.aggregate({
      where: { status: unpaid, dueDate: { gt: today, lte: in7 } },
      _count: true,
      _sum: { amount: true },
    }),
    db.bill.aggregate({
      where: { status: unpaid, dueDate: { lt: today } },
      _count: true,
      _sum: { amount: true },
    }),
    db.bill.aggregate({
      where: { status: "PAID", paidAt: { gte: monthStart, lt: nextMonth } },
      _count: true,
      _sum: { paidAmount: true },
    }),
    db.ticket.count({ where: { status: "OPEN" } }),
    db.ticket.count({ where: { status: "IN_PROGRESS" } }),
    db.contract.count({
      where: {
        status: "ACTIVE",
        OR: [
          { endDate: { lte: in30 } },
          { renewalDate: { lte: in30 } },
        ],
      },
    }),
    db.bill.findMany({
      where: { status: unpaid, dueDate: { lte: in7 } },
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
  ]);

  return {
    today,
    dueToday,
    dueSoon,
    overdue,
    paidThisMonth,
    pendingTickets: openTickets + inProgressTickets,
    openTickets,
    inProgressTickets,
    expiringContracts,
    alertBills,
  };
}
