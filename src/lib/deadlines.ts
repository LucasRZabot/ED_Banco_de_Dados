import { daysUntil, todayInTz } from "@/lib/dates";

export type DeadlineLevel = "ok" | "warning" | "danger" | "paid";

export const DEFAULT_WARNING_DAYS = 5;

/**
 * Verde: mais de `warningDays` dias. Amarelo: 1 até `warningDays`.
 * Vermelho: hoje ou atrasado. Pago ignora a data.
 */
export function getDeadlineLevel(
  dueDate: Date,
  opts: { today?: Date; warningDays?: number; paid?: boolean } = {},
): DeadlineLevel {
  if (opts.paid) return "paid";
  const days = daysUntil(dueDate, opts.today ?? todayInTz());
  const warningDays = opts.warningDays ?? DEFAULT_WARNING_DAYS;
  if (days <= 0) return "danger";
  if (days <= warningDays) return "warning";
  return "ok";
}

export function deadlineLabel(level: DeadlineLevel, days: number) {
  if (level === "paid") return "Pago";
  if (days < 0) return `Atrasado há ${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  return `Vence em ${days} dias`;
}
