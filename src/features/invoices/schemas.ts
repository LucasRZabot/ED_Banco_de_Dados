import { z } from "zod";
import { parseMoney } from "@/lib/format";
import { isValidCnpj, onlyDigits } from "@/lib/validators/cnpj";
import { INVOICE_STATUSES } from "./labels";

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

export const submitInvoiceSchema = z.object({
  description: z.string().trim().min(8, "Descreva do que se trata a nota (pelo menos 8 caracteres).").max(4000),
  sectorId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
});

export const postInvoiceSchema = z
  .object({
    invoiceId: z.string().min(1),
    number: z.string().trim().min(1, "Informe o número da nota.").max(20),
    series: z.string().trim().min(1, "Informe a série.").max(5),
    accessKey: z
      .string()
      .trim()
      .optional()
      .transform((v) => {
        const d = onlyDigits(v ?? "");
        return d ? d : null;
      })
      .pipe(z.string().length(44, "A chave de acesso da NF-e tem 44 dígitos.").nullable()),
    amount: moneyField("o valor"),
    issueDate: z.iso.date("Informe a data de emissão."),
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
    quoteId: optionalId,
    contractId: optionalId,
    ticketId: optionalId,
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

export const invoiceFiltersSchema = z.object({
  status: z.enum(INVOICE_STATUSES).optional(),
  supplierId: z.string().min(1).optional(),
  sectorId: z.string().min(1).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  q: z.string().trim().max(80).optional(),
});

export type InvoiceFilters = z.infer<typeof invoiceFiltersSchema>;
