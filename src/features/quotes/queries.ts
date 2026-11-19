import "server-only";
import { notFound } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { canViewQuote } from "@/lib/access";
import type { CurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import type { QuoteFilters } from "./schemas";

function dateBound(value: string | undefined, endOfDay: boolean) {
  if (!value) return undefined;
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}.000Z`);
}

export async function listQuotes(user: CurrentUser, filters: QuoteFilters) {
  if (!canViewQuote(user)) return [];
  const where: Prisma.QuoteWhereInput = {
    status: filters.status,
    supplierId: filters.supplierId,
    ticketId: filters.ticketId,
    validUntil:
      filters.from || filters.to
        ? { gte: dateBound(filters.from, false), lte: dateBound(filters.to, true) }
        : undefined,
    OR: filters.q
      ? [
          { description: { contains: filters.q, mode: "insensitive" } },
          { supplier: { legalName: { contains: filters.q, mode: "insensitive" } } },
          { ticket: { title: { contains: filters.q, mode: "insensitive" } } },
        ]
      : undefined,
  };

  return db.quote.findMany({
    where,
    orderBy: [{ status: "asc" }, { amount: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      supplier: { select: { id: true, legalName: true, cnpj: true } },
      ticket: { select: { id: true, code: true, title: true, type: true, status: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      attachments: { select: { id: true, category: true }, take: 8 },
    },
  });
}

export async function getQuoteOrNotFound(user: CurrentUser, id: string) {
  if (!canViewQuote(user)) notFound();
  const quote = await db.quote.findUnique({
    where: { id },
    include: {
      supplier: true,
      ticket: {
        select: {
          id: true,
          code: true,
          title: true,
          type: true,
          status: true,
          sectorId: true,
          sector: { select: { id: true, name: true, costCenter: true } },
        },
      },
      createdBy: { select: { id: true, name: true, email: true } },
      decidedBy: { select: { id: true, name: true, email: true } },
      invoices: {
        where: { status: { not: "CANCELED" } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          number: true,
          amount: true,
          description: true,
        },
      },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!quote) notFound();
  return quote;
}

export async function listSectorsForQuotes() {
  return db.sector.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, costCenter: true },
  });
}

export async function listSuppliersForQuotes() {
  return db.supplier.findMany({
    where: { active: true },
    orderBy: { legalName: "asc" },
    select: { id: true, legalName: true, tradeName: true, cnpj: true },
  });
}

export async function listPurchaseTicketsForQuotes(extraTicketId?: string | null) {
  return db.ticket.findMany({
    where: {
      type: "PURCHASE_QUOTE",
      OR: extraTicketId
        ? [{ status: { in: ["OPEN", "IN_PROGRESS"] } }, { id: extraTicketId }]
        : [{ status: { in: ["OPEN", "IN_PROGRESS"] } }],
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      sector: { select: { name: true, costCenter: true } },
    },
  });
}

export async function listQuotesForTicket(ticketId: string) {
  return db.quote.findMany({
    where: { ticketId },
    orderBy: [{ amount: "asc" }, { createdAt: "asc" }],
    include: {
      supplier: { select: { id: true, legalName: true, cnpj: true } },
      attachments: { select: { id: true }, take: 1 },
    },
  });
}
