import type { BillStatus } from "@/generated/prisma/enums";
import type { DeadlineLevel } from "@/lib/deadlines";

export const BILL_STATUSES = ["TO_PAY", "PAID", "OVERDUE"] as const;

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  TO_PAY: "A pagar",
  PAID: "Pago",
  OVERDUE: "Atrasado",
};

export const DEADLINE_LEVEL_LABELS: Record<DeadlineLevel, string> = {
  ok: "Em dia",
  warning: "Próximo",
  danger: "Urgente",
  paid: "Pago",
};

export function billStatusBadgeVariant(status: BillStatus) {
  if (status === "PAID") return "default" as const;
  if (status === "OVERDUE") return "destructive" as const;
  return "outline" as const;
}
