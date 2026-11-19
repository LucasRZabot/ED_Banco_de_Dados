import type { InvoiceStatus } from "@/generated/prisma/enums";

export const INVOICE_STATUSES = ["PENDING", "POSTED", "CANCELED"] as const;

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  PENDING: "Pendente",
  POSTED: "Lançada",
  CANCELED: "Cancelada",
};

export function invoiceStatusBadgeVariant(status: InvoiceStatus) {
  if (status === "POSTED") return "default" as const;
  if (status === "CANCELED") return "destructive" as const;
  return "outline" as const;
}
