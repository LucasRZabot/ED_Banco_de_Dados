import { Badge } from "@/components/ui/badge";
import { daysUntil, todayInTz } from "@/lib/dates";
import { deadlineLabel, getDeadlineLevel, type DeadlineLevel } from "@/lib/deadlines";
import { cn } from "@/lib/utils";

const LEVEL_CLASS: Record<DeadlineLevel, string> = {
  ok: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  warning: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  danger: "border-transparent bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  paid: "border-transparent bg-muted text-muted-foreground",
};

export function DeadlineBadge({
  dueDate,
  paid = false,
  today,
  warningDays,
}: {
  dueDate: Date;
  paid?: boolean;
  today?: Date;
  warningDays?: number;
}) {
  const ref = today ?? todayInTz();
  const level = getDeadlineLevel(dueDate, { today: ref, warningDays, paid });
  const days = daysUntil(dueDate, ref);
  return (
    <Badge variant="outline" className={cn(LEVEL_CLASS[level])}>
      {deadlineLabel(level, days)}
    </Badge>
  );
}

export function deadlineCardClass(level: DeadlineLevel) {
  if (level === "danger") return "ring-red-200 dark:ring-red-900";
  if (level === "warning") return "ring-amber-200 dark:ring-amber-900";
  if (level === "ok") return "ring-emerald-200 dark:ring-emerald-900";
  return "";
}
