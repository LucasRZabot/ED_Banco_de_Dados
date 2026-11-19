import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { notifyUsers } from "@/features/notifications/create";
import { ticketCode } from "@/lib/format";
import { TICKET_RESULT_LABELS, TICKET_STATUS_LABELS } from "./labels";
import { applyTransition, type TicketStatus } from "./status-machine";

/**
 * Conclui um chamado de compra após o lançamento da NF convertida do orçamento.
 * OPEN não pode ir direto a COMPLETED (trigger do banco): passa por IN_PROGRESS.
 */
export async function completeLinkedTicket(
  tx: Prisma.TransactionClient,
  ticketId: string,
  userId: string,
) {
  const ticket = await tx.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, code: true, title: true, type: true, status: true, requesterId: true },
  });
  if (!ticket) return;
  if (ticket.type !== "PURCHASE_QUOTE") return;
  if (ticket.status === "COMPLETED" || ticket.status === "CANCELED") return;

  const now = new Date();
  let from = ticket.status as TicketStatus;

  if (from === "OPEN") {
    const toProgress = applyTransition("OPEN", "IN_PROGRESS", { now, assigneeId: userId });
    await tx.ticket.update({ where: { id: ticket.id }, data: toProgress });
    await tx.ticketStatusHistory.create({
      data: {
        ticketId: ticket.id,
        fromStatus: "OPEN",
        toStatus: "IN_PROGRESS",
        changedById: userId,
      },
    });
    from = "IN_PROGRESS";
  }

  const toDone = applyTransition(from, "COMPLETED", { now });
  await tx.ticket.update({ where: { id: ticket.id }, data: toDone });
  await tx.ticketStatusHistory.create({
    data: {
      ticketId: ticket.id,
      fromStatus: from,
      toStatus: "COMPLETED",
      changedById: userId,
    },
  });
  await notifyUsers(
    {
      userIds: [ticket.requesterId],
      type: "TICKET_STATUS_CHANGED",
      severity: "INFO",
      title: `Chamado ${ticketCode(ticket.code)} ${TICKET_RESULT_LABELS.COMPLETED.toLowerCase()}`,
      message: `Status: ${TICKET_STATUS_LABELS.COMPLETED}.`,
      link: `/chamados/${ticket.id}`,
      ticketId: ticket.id,
      dedupeKey: () => `ticket:${ticket.id}:STATUS:COMPLETED`,
    },
    tx,
  );
}
