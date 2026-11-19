import { z } from "zod";
import { parseMoney } from "@/lib/format";
import { isValidCnpj, onlyDigits } from "@/lib/validators/cnpj";
import { normalizeDigitableLine, validateDigitableLine } from "@/lib/validators/digitable-line";
import { BILL_STATUSES } from "./labels";

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

export const createBillSchema = z
  .object({
    digitableLine: z
      .string()
      .trim()
      .min(1, "Informe a linha digitável.")
      .superRefine((v, ctx) => {
        const result = validateDigitableLine(v);
        if (!result.ok) ctx.addIssue({ code: "custom", message: result.error });
      })
      .transform((v) => normalizeDigitableLine(v)),
    amount: moneyField("o valor"),
    dueDate: z.iso.date("Informe a data de vencimento."),
    description: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),
    installment: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? Number(v) : null))
      .pipe(z.number().int().positive("A parcela deve ser um número positivo.").nullable()),
    sectorId: z.string().min(1, "Escolha o setor / centro de custo."),
    supplierId: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),
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
    invoiceId: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),
    contractId: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),
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

export const payBillSchema = z.object({
  billId: z.string().min(1),
  paidAt: z.iso.date("Informe a data da baixa."),
  paidAmount: moneyField("o valor pago"),
  paymentNote: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
});

export const billFiltersSchema = z.object({
  status: z.enum(BILL_STATUSES).optional(),
  supplierId: z.string().min(1).optional(),
  sectorId: z.string().min(1).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  q: z.string().trim().max(80).optional(),
});

export type BillFilters = z.infer<typeof billFiltersSchema>;
