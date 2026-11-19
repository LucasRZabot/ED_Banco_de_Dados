import "server-only";
import { notFound } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { canViewTicket } from "@/lib/access";
import type { CurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import type { TicketFilters } from "./schemas";

function visibilityWhere(user: CurrentUser): Prisma.TicketWhereInput {
  if (user.role === "FINANCEIRO") return {};
  return { requesterId: user.id };
}

function dateBound(value: string | undefined, endOfDay: boolean) {
  if (!value) return undefined;
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}.000Z`);
}

export async function listTickets(user: CurrentUser, filters: TicketFilters) {
  const where: Prisma.TicketWhereInput = {
    ...visibilityWhere(user),
    status: filters.status,
    type: filters.type,
    urgency: filters.urgency,
    sectorId: user.role === "FINANCEIRO" ? filters.sectorId : undefined,
    createdAt:
      filters.from || filters.to
        ? { gte: dateBound(filters.from, false), lte: dateBound(filters.to, true) }
        : undefined,
    OR: filters.q
      ? [
          { title: { contains: filters.q, mode: "insensitive" } },
          { description: { contains: filters.q, mode: "insensitive" } },
        ]
      : undefined,
  };

  return db.ticket.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      code: true,
      type: true,
      status: true,
      urgency: true,
      title: true,
      cancellationReason: true,
      createdAt: true,
      neededBy: true,
      sector: { select: { name: true, costCenter: true } },
      requester: { select: { name: true, email: true } },
    },
  });
}

export async function listSectorsForFilter() {
  return db.sector.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, costCenter: true },
  });
}

export async function getTicketOrNotFound(user: CurrentUser, id: string) {
  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      sector: { select: { id: true, name: true, costCenter: true } },
      requester: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      attachments: { orderBy: { createdAt: "asc" } },
      comments: {
        where: user.role === "FINANCEIRO" ? undefined : { visibility: "PUBLIC" },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, email: true, role: true } } },
      },
      statusHistory: {
        orderBy: { createdAt: "asc" },
        include: { changedBy: { select: { name: true, email: true } } },
      },
    },
  });
  if (!ticket || !canViewTicket(user, ticket.requesterId)) notFound();
  return ticket;
}
