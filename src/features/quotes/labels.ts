import type { QuoteStatus } from "@/generated/prisma/enums";

export const QUOTE_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
};

export function quoteStatusBadgeVariant(status: QuoteStatus) {
  if (status === "APPROVED") return "default" as const;
  if (status === "REJECTED") return "destructive" as const;
  return "outline" as const;
}
