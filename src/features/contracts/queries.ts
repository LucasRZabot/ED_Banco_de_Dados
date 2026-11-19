import "server-only";
import { notFound } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { canViewContract } from "@/lib/access";
import type { CurrentUser } from "@/lib/dal";
import { addDays, todayInTz } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/format";
import type { ContractFilters } from "./schemas";

function dateBound(value: string | undefined, endOfDay: boolean) {
  if (!value) return undefined;
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}.000Z`);
}

export async function listContracts(user: CurrentUser, filters: ContractFilters) {
  if (!canViewContract(user)) return [];
  const today = todayInTz();
  const in30 = addDays(today, 30);
  const from = dateBound(filters.from, false);
  const to = dateBound(filters.to, true);

  const and: Prisma.ContractWhereInput[] = [];
  if (filters.q) {
    and.push({
      OR: [
        { object: { contains: filters.q, mode: "insensitive" } },
        { code: { contains: filters.q, mode: "insensitive" } },
        { supplier: { legalName: { contains: filters.q, mode: "insensitive" } } },
      ],
    });
  }
  if (filters.expiring === "1") {
    and.push({ OR: [{ endDate: { lte: in30 } }, { renewalDate: { lte: in30 } }] });
  } else if (from || to) {
    and.push({ OR: [{ endDate: { gte: from, lte: to } }, { renewalDate: { gte: from, lte: to } }] });
  }

  const where: Prisma.ContractWhereInput = {
    status: filters.expiring === "1" ? "ACTIVE" : filters.status,
    supplierId: filters.supplierId,
    sectorId: filters.sectorId,
    AND: and.length ? and : undefined,
  };

  return db.contract.findMany({
    where,
    orderBy: [{ status: "asc" }, { endDate: "asc" }, { renewalDate: "asc" }],
    take: 200,
    include: {
      supplier: { select: { id: true, legalName: true, cnpj: true } },
      sector: { select: { id: true, name: true, costCenter: true } },
      ticket: { select: { id: true, code: true, title: true } },
      attachments: { select: { id: true, category: true }, take: 4 },
    },
  });
}

export async function getContractOrNotFound(user: CurrentUser, id: string) {
  if (!canViewContract(user)) notFound();
  const contract = await db.contract.findUnique({
    where: { id },
    include: {
      supplier: true,
      sector: true,
      ticket: { select: { id: true, code: true, title: true, type: true, status: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      invoices: {
        where: { status: { not: "CANCELED" } },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, number: true, amount: true, description: true, issueDate: true },
      },
      bills: {
        orderBy: { dueDate: "asc" },
        select: { id: true, status: true, amount: true, dueDate: true, description: true },
      },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!contract) notFound();
  return contract;
}

export async function getContractByTicketId(ticketId: string) {
  return db.contract.findUnique({
    where: { ticketId },
    select: { id: true, object: true, status: true, code: true },
  });
}

export async function listSectorsForContracts() {
  return db.sector.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, costCenter: true },
  });
}

export async function listSuppliersForContracts() {
  return db.supplier.findMany({
    where: { active: true },
    orderBy: { legalName: "asc" },
    select: { id: true, legalName: true, tradeName: true, cnpj: true },
  });
}

export async function getApprovedQuoteDraft(quoteId: string) {
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      status: true,
      amount: true,
      description: true,
      supplierId: true,
      ticket: { select: { sectorId: true } },
    },
  });
  if (!quote || quote.status !== "APPROVED") return null;
  return {
    quoteId: quote.id,
    supplierId: quote.supplierId,
    sectorId: quote.ticket?.sectorId ?? "",
    object: quote.description?.trim() || `Contrato a partir do orçamento ${formatBRL(quote.amount)}`,
    totalValue: Number(quote.amount).toFixed(2).replace(".", ","),
    notes: `Origem: orçamento ${quote.id}`,
  };
}

export async function listInclusionTicketsForContracts(extraTicketId?: string | null) {
  return db.ticket.findMany({
    where: {
      type: "CONTRACT_INCLUSION",
      OR: extraTicketId
        ? [{ status: { in: ["OPEN", "IN_PROGRESS"] }, contract: { is: null } }, { id: extraTicketId }]
        : [{ status: { in: ["OPEN", "IN_PROGRESS"] }, contract: { is: null } }],
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      sectorId: true,
      sector: { select: { name: true, costCenter: true } },
    },
  });
}
