import "server-only";
import { notFound } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { canViewBill } from "@/lib/access";
import type { CurrentUser } from "@/lib/dal";
import { addDays, parseDateOnly, todayInTz } from "@/lib/dates";
import { db } from "@/lib/db";
import type { BillFilters } from "./schemas";

function dateBound(value: string | undefined, endOfDay: boolean) {
  if (!value) return undefined;
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}.000Z`);
}

export async function listBills(user: CurrentUser, filters: BillFilters) {
  if (!canViewBill(user)) return [];
  const today = todayInTz();
  const due: Prisma.DateTimeFilter = {};
  if (filters.from) due.gte = dateBound(filters.from, false);
  if (filters.to) due.lte = dateBound(filters.to, true);
  if (filters.status === "OVERDUE") {
    due.lt = today;
  } else if (filters.status === "TO_PAY") {
    due.gte = !due.gte || due.gte < today ? today : due.gte;
  }

  const where: Prisma.BillWhereInput = {
    supplierId: filters.supplierId,
    sectorId: filters.sectorId,
    dueDate: Object.keys(due).length ? due : undefined,
    status: filters.status === "PAID" ? "PAID" : filters.status ? { not: "PAID" } : undefined,
    OR: filters.q
      ? [
          { description: { contains: filters.q, mode: "insensitive" } },
          { digitableLine: { contains: filters.q.replace(/\D/g, "") } },
          { supplier: { legalName: { contains: filters.q, mode: "insensitive" } } },
        ]
      : undefined,
  };

  return db.bill.findMany({
    where,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    take: 200,
    include: {
      supplier: { select: { id: true, legalName: true, tradeName: true, cnpj: true } },
      sector: { select: { id: true, name: true, costCenter: true } },
      attachments: { select: { id: true, category: true }, take: 8 },
    },
  });
}

export async function getBillOrNotFound(user: CurrentUser, id: string) {
  if (!canViewBill(user)) notFound();
  const bill = await db.bill.findUnique({
    where: { id },
    include: {
      supplier: true,
      sector: true,
      createdBy: { select: { name: true, email: true } },
      paidBy: { select: { name: true, email: true } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!bill) notFound();
  return bill;
}

export async function listSectorsForBills() {
  return db.sector.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, costCenter: true },
  });
}

export async function listSuppliersForBills() {
  return db.supplier.findMany({
    where: { active: true },
    orderBy: { legalName: "asc" },
    select: { id: true, legalName: true, tradeName: true, cnpj: true },
  });
}

export function effectiveBillStatus(bill: { status: string; dueDate: Date }, today = todayInTz()) {
  if (bill.status === "PAID") return "PAID" as const;
  if (bill.dueDate < today) return "OVERDUE" as const;
  return "TO_PAY" as const;
}

export function dueWindow(fromOffset: number, toOffset: number, today = todayInTz()) {
  return { gte: addDays(today, fromOffset), lte: addDays(today, toOffset) };
}

export { parseDateOnly };
