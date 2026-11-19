import { Badge } from "@/components/ui/badge";
import type { QuoteStatus } from "@/generated/prisma/enums";
import { QUOTE_STATUS_LABELS, quoteStatusBadgeVariant } from "../labels";

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge variant={quoteStatusBadgeVariant(status)}>{QUOTE_STATUS_LABELS[status]}</Badge>;
}
