import { Badge } from "@/components/ui/badge";
import type { ContractStatus } from "@/generated/prisma/enums";
import { CONTRACT_STATUS_LABELS, contractStatusBadgeVariant } from "../labels";

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return <Badge variant={contractStatusBadgeVariant(status)}>{CONTRACT_STATUS_LABELS[status]}</Badge>;
}
