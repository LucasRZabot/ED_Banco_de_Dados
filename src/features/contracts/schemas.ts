import { z } from "zod";
import { parseMoney } from "@/lib/format";
import { isValidCnpj, onlyDigits } from "@/lib/validators/cnpj";
import { CONTRACT_STATUSES } from "./labels";

const optionalMoney = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => {
      if (!v) return null;
      const n = parseMoney(v);
      return n == null ? Number.NaN : Math.round(n * 100) / 100;
    })
    .pipe(z.number({ error: `${label} inválido.` }).gt(0, `${label} deve ser maior que zero.`).nullable());

const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.iso.date().nullable().or(z.null()));

export const createContractSchema = z
  .object({
    code: z
      .string()
      .trim()
      .max(40)
      .optional()
      .transform((v) => (v ? v : null)),
    object: z.string().trim().min(8, "Descreva o objeto do contrato (pelo menos 8 caracteres).").max(4000),
    monthlyValue: optionalMoney("o valor mensal"),
    totalValue: optionalMoney("o valor total"),
    startDate: z.iso.date("Informe a data de início."),
    endDate: optionalDate,
    renewalDate: optionalDate,
    autoRenew: z
      .string()
      .optional()
      .transform((v) => v === "1" || v === "on" || v === "true"),
    alertDaysBefore: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? Number(v) : 30))
      .pipe(z.number().int().min(0).max(365, "Os dias de antecedência vão de 0 a 365.")),
    notes: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),
    sectorId: z.string().min(1, "Escolha o setor / centro de custo."),
    ticketId: optionalId,
    quoteId: optionalId,
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
    if (!data.supplierId) {
      if (!data.supplierLegalName) {
        ctx.addIssue({ code: "custom", path: ["supplierLegalName"], message: "Informe a razão social do fornecedor." });
      }
      if (!data.supplierCnpj || !isValidCnpj(data.supplierCnpj)) {
        ctx.addIssue({ code: "custom", path: ["supplierCnpj"], message: "CNPJ inválido." });
      }
    }
    if (data.monthlyValue == null && data.totalValue == null) {
      ctx.addIssue({ code: "custom", path: ["monthlyValue"], message: "Informe o valor mensal ou o valor total." });
    }
    if (data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "O término deve ser igual ou posterior ao início." });
    }
  });

export const contractFiltersSchema = z.object({
  status: z.enum(CONTRACT_STATUSES).optional(),
  supplierId: z.string().min(1).optional(),
  sectorId: z.string().min(1).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  q: z.string().trim().max(80).optional(),
  expiring: z.enum(["1"]).optional(),
});

export type ContractFilters = z.infer<typeof contractFiltersSchema>;
