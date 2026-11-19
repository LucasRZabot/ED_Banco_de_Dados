import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "@/generated/prisma/enums";
import { INVOICE_STATUS_LABELS, invoiceStatusBadgeVariant } from "../labels";

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge variant={invoiceStatusBadgeVariant(status)}>{INVOICE_STATUS_LABELS[status]}</Badge>;
}
