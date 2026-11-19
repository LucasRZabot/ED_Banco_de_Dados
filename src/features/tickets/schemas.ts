import { z } from "zod";
import { COMMENT_VISIBILITIES, TICKET_STATUSES, TICKET_TYPES, URGENCIES } from "./status-machine";

export const createTicketSchema = z.object({
  type: z.enum(TICKET_TYPES, { error: "Escolha o tipo do chamado." }),
  title: z.string().trim().min(5, "O título deve ter pelo menos 5 caracteres.").max(160),
  description: z.string().trim().min(10, "Descreva o pedido com pelo menos 10 caracteres."),
  justification: z.string().trim().min(10, "Informe a justificativa."),
  quantity: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().positive("A quantidade deve ser um número positivo.").nullable()),
  urgency: z.enum(URGENCIES),
  neededBy: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.iso.date().nullable().or(z.null())),
});

export const changeStatusSchema = z.object({
  ticketId: z.string().min(1),
  toStatus: z.enum(TICKET_STATUSES),
  reason: z.string().trim().optional(),
});

export const commentSchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().trim().min(2, "Escreva o comentário.").max(4000),
  visibility: z.enum(COMMENT_VISIBILITIES).default("PUBLIC"),
});

export const ticketFiltersSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  type: z.enum(TICKET_TYPES).optional(),
  urgency: z.enum(URGENCIES).optional(),
  sectorId: z.string().min(1).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  q: z.string().trim().max(80).optional(),
});

export type TicketFilters = z.infer<typeof ticketFiltersSchema>;
