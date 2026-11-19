import type { ContractStatus } from "@/generated/prisma/enums";

export const CONTRACT_STATUSES = ["ACTIVE", "EXPIRED", "TERMINATED"] as const;

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  ACTIVE: "Ativo",
  EXPIRED: "Vencido",
  TERMINATED: "Encerrado",
};

export function contractStatusBadgeVariant(status: ContractStatus) {
  if (status === "ACTIVE") return "default" as const;
  if (status === "EXPIRED") return "destructive" as const;
  return "outline" as const;
}

export function contractAlertOn(contract: { renewalDate: Date | null; endDate: Date | null }) {
  return contract.renewalDate ?? contract.endDate;
}
