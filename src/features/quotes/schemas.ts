import { z } from "zod";
import { parseMoney } from "@/lib/format";
import { isValidCnpj, onlyDigits } from "@/lib/validators/cnpj";
import { QUOTE_STATUSES } from "./labels";

const moneyField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Informe ${label}.`)
    .transform((v) => {
      const n = parseMoney(v);
      return n == null ? n : Math.round(n * 100) / 100;
    })
    .pipe(z.number({ error: `${label} inválido.` }).gt(0, `${label} deve ser maior que zero.`));

const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

export const createQuoteSchema = z
  .object({
    amount: moneyField("o valor cotado"),
    validUntil: z.iso.date("Informe a validade da proposta."),
    description: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),
    ticketId: optionalId,
    supplierId: optionalId,
    supplierLegalName: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),
    supplierCnpj: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? onlyDigits(v) : null)),
  })
  .superRefine((data, ctx) => {
    if (data.supplierId) return;
    if (!data.supplierLegalName) {
      ctx.addIssue({ code: "custom", path: ["supplierLegalName"], message: "Informe a razão social do fornecedor." });
    }
    if (!data.supplierCnpj || !isValidCnpj(data.supplierCnpj)) {
      ctx.addIssue({ code: "custom", path: ["supplierCnpj"], message: "CNPJ inválido." });
    }
  });

export const decideQuoteSchema = z
  .object({
    quoteId: z.string().min(1),
    decision: z.enum(["APPROVED", "REJECTED"]),
    decisionNote: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),
    rejectSiblings: z
      .string()
      .optional()
      .transform((v) => v === "1" || v === "on" || v === "true"),
  })
  .superRefine((data, ctx) => {
    if (data.decision === "REJECTED" && (!data.decisionNote || data.decisionNote.length < 5)) {
      ctx.addIssue({
        code: "custom",
        path: ["decisionNote"],
        message: "Informe o motivo da reprovação (pelo menos 5 caracteres).",
      });
    }
  });

export const convertQuoteSchema = z.object({
  quoteId: z.string().min(1),
  sectorId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
});

export const quoteFiltersSchema = z.object({
  status: z.enum(QUOTE_STATUSES).optional(),
  supplierId: z.string().min(1).optional(),
  ticketId: z.string().min(1).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  q: z.string().trim().max(80).optional(),
});

export type QuoteFilters = z.infer<typeof quoteFiltersSchema>;
