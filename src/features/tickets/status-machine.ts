export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_TYPES = ["PURCHASE_QUOTE", "CONTRACT_INCLUSION"] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const URGENCIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const COMMENT_VISIBILITIES = ["PUBLIC", "INTERNAL"] as const;
export type CommentVisibility = (typeof COMMENT_VISIBILITIES)[number];

/** Transições permitidas pelo trigger do banco. */
export const TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "CANCELED"],
  IN_PROGRESS: ["COMPLETED", "CANCELED"],
  COMPLETED: [],
  CANCELED: [],
};

export class TicketFlowError extends Error {}

export function canTransition(from: TicketStatus, to: TicketStatus) {
  return TRANSITIONS[from].includes(to);
}

export function transitionRequiresReason(to: TicketStatus) {
  return to === "CANCELED";
}

export type TicketPatch = {
  status: TicketStatus;
  cancellationReason?: string;
  processingStartedAt?: Date;
  closedAt?: Date;
  assigneeId?: string;
};

/**
 * Calcula o patch do chamado para uma transição. O banco ainda recusa o que sair da regra;
 * daqui sai o motivo, as datas e o responsável.
 */
export function applyTransition(
  from: TicketStatus,
  to: TicketStatus,
  opts: { now?: Date; reason?: string | null; assigneeId?: string } = {},
): TicketPatch {
  if (!canTransition(from, to)) {
    throw new TicketFlowError(`Não é possível ir de ${from} para ${to}.`);
  }
  const now = opts.now ?? new Date();
  const patch: TicketPatch = { status: to };

  if (to === "CANCELED") {
    const reason = opts.reason?.trim();
    if (!reason) throw new TicketFlowError("Informe o motivo do cancelamento.");
    patch.cancellationReason = reason;
    patch.closedAt = now;
  }
  if (to === "IN_PROGRESS") {
    patch.processingStartedAt = now;
    if (opts.assigneeId) patch.assigneeId = opts.assigneeId;
  }
  if (to === "COMPLETED") patch.closedAt = now;
  return patch;
}
