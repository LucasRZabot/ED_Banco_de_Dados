import type { CommentVisibility, TicketStatus, TicketType, Urgency } from "./status-machine";

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em Processamento",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
};

/** Como a chefia lê o resultado da avaliação. */
export const TICKET_RESULT_LABELS: Record<TicketStatus, string> = {
  OPEN: "Aguardando avaliação",
  IN_PROGRESS: "Aprovado",
  COMPLETED: "Aprovado",
  CANCELED: "Reprovado",
};

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  PURCHASE_QUOTE: "Compra / Orçamento",
  CONTRACT_INCLUSION: "Inclusão de Contrato",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export const COMMENT_VISIBILITY_LABELS: Record<CommentVisibility, string> = {
  PUBLIC: "Resposta à chefia",
  INTERNAL: "Comentário interno",
};

export function statusBadgeVariant(status: TicketStatus) {
  if (status === "OPEN") return "outline" as const;
  if (status === "IN_PROGRESS") return "secondary" as const;
  if (status === "COMPLETED") return "default" as const;
  return "destructive" as const;
}
