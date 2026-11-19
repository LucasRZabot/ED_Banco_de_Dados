import type { DashboardStatus } from "./schemas";

export const DASHBOARD_STATUS_LABELS: Record<DashboardStatus, string> = {
  BILL_TO_PAY: "Boletos a pagar",
  BILL_OVERDUE: "Boletos atrasados",
  BILL_PAID: "Boletos pagos",
  INVOICE_PENDING: "NFs pendentes",
  TICKET_OPEN: "Chamados abertos",
  QUOTE_PENDING: "Orçamentos pendentes",
  CONTRACT_ACTIVE: "Contratos ativos",
};

export type DashboardListKind = "bills" | "invoices" | "tickets" | "quotes" | "contracts";

export const DASHBOARD_STATUS_LIST: Record<DashboardStatus, DashboardListKind> = {
  BILL_TO_PAY: "bills",
  BILL_OVERDUE: "bills",
  BILL_PAID: "bills",
  INVOICE_PENDING: "invoices",
  TICKET_OPEN: "tickets",
  QUOTE_PENDING: "quotes",
  CONTRACT_ACTIVE: "contracts",
};
