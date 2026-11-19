import { Badge } from "@/components/ui/badge";
import type { BillStatus } from "@/generated/prisma/enums";
import { BILL_STATUS_LABELS, billStatusBadgeVariant } from "../labels";

export function BillStatusBadge({ status }: { status: BillStatus }) {
  return <Badge variant={billStatusBadgeVariant(status)}>{BILL_STATUS_LABELS[status]}</Badge>;
}
