import "server-only";
import { notFound } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { canViewInvoice } from "@/lib/access";
import type { CurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { parseNfeXml } from "@/lib/nfe-xml";
import { getFileBlobText } from "@/lib/blobs";
import type { InvoiceFilters } from "./schemas";

function visibilityWhere(user: CurrentUser): Prisma.InvoiceWhereInput {
  if (user.role === "FINANCEIRO") return {};
  if (user.role === "REQUESTER") return { submittedById: user.id };
  return { id: "__none__" };
}

function dateBound(value: string | undefined, endOfDay: boolean) {
  if (!value) return undefined;
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}.000Z`);
}

export async function listInvoices(user: CurrentUser, filters: InvoiceFilters) {
  if (user.role !== "FINANCEIRO" && user.role !== "REQUESTER") return [];
  const where: Prisma.InvoiceWhereInput = {
    ...visibilityWhere(user),
    status: filters.status,
    supplierId: user.role === "FINANCEIRO" ? filters.supplierId : undefined,
    sectorId: user.role === "FINANCEIRO" ? filters.sectorId : undefined,
    issueDate:
      filters.from || filters.to
        ? { gte: dateBound(filters.from, false), lte: dateBound(filters.to, true) }
        : undefined,
    OR: filters.q
      ? [
          { description: { contains: filters.q, mode: "insensitive" } },
          { number: { contains: filters.q, mode: "insensitive" } },
          { supplier: { legalName: { contains: filters.q, mode: "insensitive" } } },
        ]
      : undefined,
  };

  return db.invoice.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      supplier: { select: { id: true, legalName: true, cnpj: true } },
      sector: { select: { id: true, name: true, costCenter: true } },
      submittedBy: { select: { id: true, name: true, email: true } },
      attachments: { select: { id: true, category: true }, take: 8 },
    },
  });
}

export async function getInvoiceOrNotFound(user: CurrentUser, id: string) {
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      supplier: true,
      sector: true,
      quote: { select: { id: true, description: true, amount: true } },
      contract: { select: { id: true, object: true, code: true } },
      ticket: { select: { id: true, code: true, title: true } },
      submittedBy: { select: { id: true, name: true, email: true } },
      postedBy: { select: { id: true, name: true, email: true } },
      bills: { select: { id: true, amount: true, dueDate: true, status: true }, orderBy: { dueDate: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!invoice || !canViewInvoice(user, invoice.submittedById)) notFound();
  return invoice;
}

export async function prefillFromXmlAttachment(fileKey: string) {
  try {
    const parsed = parseNfeXml(await getFileBlobText(fileKey));
    return parsed.ok ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function listSectorsForInvoices() {
  return db.sector.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, costCenter: true },
  });
}

export async function listSuppliersForInvoices() {
  return db.supplier.findMany({
    where: { active: true },
    orderBy: { legalName: "asc" },
    select: { id: true, legalName: true, tradeName: true, cnpj: true },
  });
}

export async function listLinksForPost(opts?: { quoteId?: string | null; ticketId?: string | null }) {
  const [quotes, contracts, tickets] = await Promise.all([
    db.quote.findMany({
      where: opts?.quoteId ? { OR: [{ status: "APPROVED" }, { id: opts.quoteId }] } : { status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: {
        id: true,
        description: true,
        amount: true,
        supplier: { select: { legalName: true } },
      },
    }),
    db.contract.findMany({
      where: { status: "ACTIVE" },
      orderBy: { object: "asc" },
      take: 80,
      select: { id: true, object: true, code: true, supplier: { select: { legalName: true } } },
    }),
    db.ticket.findMany({
      where: opts?.ticketId
        ? { OR: [{ status: { in: ["OPEN", "IN_PROGRESS"] } }, { id: opts.ticketId }] }
        : { status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: { id: true, code: true, title: true },
    }),
  ]);
  return {
    quotes: quotes.map((q) => ({ ...q, amount: q.amount.toFixed(2) })),
    contracts,
    tickets,
  };
}
