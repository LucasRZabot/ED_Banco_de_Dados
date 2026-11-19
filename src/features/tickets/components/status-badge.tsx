import { Badge } from "@/components/ui/badge";
import { statusBadgeVariant, TICKET_RESULT_LABELS, TICKET_STATUS_LABELS } from "../labels";
import type { TicketStatus } from "../status-machine";

export function TicketStatusBadge({
  status,
  showResult = false,
}: {
  status: TicketStatus;
  showResult?: boolean;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant={statusBadgeVariant(status)}>{TICKET_STATUS_LABELS[status]}</Badge>
      {showResult && status !== "OPEN" ? (
        <Badge variant={status === "CANCELED" ? "destructive" : "outline"}>{TICKET_RESULT_LABELS[status]}</Badge>
      ) : null}
    </span>
  );
}
