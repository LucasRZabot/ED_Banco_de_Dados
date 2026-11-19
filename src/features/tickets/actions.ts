"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canViewTicket } from "@/lib/access";
import { AttachmentError, attachUploadedFile } from "@/lib/attachments";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { financeUserIds, notifyUsers } from "@/features/notifications/create";
import { TICKET_RESULT_LABELS, TICKET_STATUS_LABELS } from "./labels";
import { changeStatusSchema, commentSchema, createTicketSchema } from "./schemas";
import { applyTransition, TicketFlowError, type TicketStatus } from "./status-machine";

export type TicketFormState =
  | { error?: string; fieldErrors?: Record<string, string[] | undefined> }
  | undefined;

function tokensFrom(formData: FormData) {
  return formData
    .getAll("uploadTokens")
    .filter((v): v is string => typeof v === "string" && v.length > 0);
}

function neededByDate(value: string | null) {
  return value ? new Date(`${value}T12:00:00.000Z`) : null;
}

export async function createTicket(_prev: TicketFormState, formData: FormData): Promise<TicketFormState> {
  const user = await requireRole("REQUESTER");
  if (!user.sectorId) return { error: "Sua conta não está vinculada a um setor." };

  const parsed = createTicketSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const tokens = tokensFrom(formData);
  let ticketId = "";

  try {
    ticketId = await db.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          type: parsed.data.type,
          title: parsed.data.title,
          description: parsed.data.description,
          justification: parsed.data.justification,
          quantity: parsed.data.quantity,
          urgency: parsed.data.urgency,
          neededBy: neededByDate(parsed.data.neededBy),
          sectorId: user.sectorId!,
          requesterId: user.id,
        },
      });
      await tx.ticketStatusHistory.create({
        data: { ticketId: ticket.id, fromStatus: null, toStatus: "OPEN", changedById: user.id },
      });
      for (const token of tokens) {
        await attachUploadedFile(token, user, { ticketId: ticket.id }, ["TICKET"], tx);
      }
      const finance = await financeUserIds(tx);
      await notifyUsers(
        {
          userIds: finance,
          type: "TICKET_CREATED",
          severity: parsed.data.urgency === "CRITICAL" || parsed.data.urgency === "HIGH" ? "WARNING" : "INFO",
          title: `Novo chamado ${ticketCode(ticket.code)}`,
          message: `${user.name ?? user.email} abriu “${ticket.title}”.`,
          link: `/chamados/${ticket.id}`,
          ticketId: ticket.id,
          dedupeKey: () => `ticket:${ticket.id}:CREATED`,
        },
        tx,
      );
      return ticket.id;
    });
  } catch (err) {
    if (err instanceof AttachmentError) return { error: err.message };
    throw err;
  }

  revalidatePath("/chamados");
  revalidatePath("/dashboard");
  redirect(`/chamados/${ticketId}`);
}

function ticketCode(code: number) {
  return `#${code}`;
}

export async function changeTicketStatus(_prev: TicketFormState, formData: FormData): Promise<TicketFormState> {
  const user = await requireRole("FINANCEIRO");
  const parsed = changeStatusSchema.safeParse({
    ticketId: formData.get("ticketId"),
    toStatus: formData.get("toStatus"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const ticket = await db.ticket.findUnique({
    where: { id: parsed.data.ticketId },
    select: { id: true, code: true, title: true, status: true, requesterId: true },
  });
  if (!ticket) return { error: "Chamado não encontrado." };

  let patch;
  try {
    patch = applyTransition(ticket.status as TicketStatus, parsed.data.toStatus, {
      reason: parsed.data.reason,
      assigneeId: user.id,
    });
  } catch (err) {
    if (err instanceof TicketFlowError) return { error: err.message };
    throw err;
  }

  await db.$transaction(async (tx) => {
    await tx.ticket.update({ where: { id: ticket.id }, data: patch });
    await tx.ticketStatusHistory.create({
      data: {
        ticketId: ticket.id,
        fromStatus: ticket.status,
        toStatus: patch.status,
        changedById: user.id,
        note: patch.cancellationReason,
      },
    });
    await notifyUsers(
      {
        userIds: [ticket.requesterId],
        type: "TICKET_STATUS_CHANGED",
        severity: patch.status === "CANCELED" ? "CRITICAL" : "INFO",
        title: `Chamado ${ticketCode(ticket.code)} ${TICKET_RESULT_LABELS[patch.status].toLowerCase()}`,
        message:
          patch.status === "CANCELED"
            ? `Reprovado: ${patch.cancellationReason}`
            : `Status: ${TICKET_STATUS_LABELS[patch.status]}.`,
        link: `/chamados/${ticket.id}`,
        ticketId: ticket.id,
        dedupeKey: () => `ticket:${ticket.id}:STATUS:${patch.status}`,
      },
      tx,
    );
  });

  revalidatePath("/chamados");
  revalidatePath(`/chamados/${ticket.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/notificacoes");
}

export async function addTicketComment(_prev: TicketFormState, formData: FormData): Promise<TicketFormState> {
  const user = await requireRole("FINANCEIRO", "REQUESTER");
  const parsed = commentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const visibility = user.role === "REQUESTER" ? "PUBLIC" : parsed.data.visibility;
  const ticket = await db.ticket.findUnique({
    where: { id: parsed.data.ticketId },
    select: { id: true, code: true, title: true, requesterId: true, status: true },
  });
  if (!ticket || !canViewTicket(user, ticket.requesterId)) return { error: "Chamado não encontrado." };

  const comment = await db.ticketComment.create({
    data: { ticketId: ticket.id, authorId: user.id, visibility, body: parsed.data.body },
  });

  if (visibility === "PUBLIC") {
    const recipients =
      user.role === "REQUESTER" ? await financeUserIds() : [ticket.requesterId].filter((id) => id !== user.id);
    await notifyUsers({
      userIds: recipients,
      type: "TICKET_COMMENT",
      title: `Novo comentário no chamado ${ticketCode(ticket.code)}`,
      message: parsed.data.body.slice(0, 180),
      link: `/chamados/${ticket.id}`,
      ticketId: ticket.id,
      dedupeKey: () => `ticket:${ticket.id}:COMMENT:${comment.id}`,
    });
  }

  revalidatePath(`/chamados/${ticket.id}`);
  revalidatePath("/notificacoes");
}
