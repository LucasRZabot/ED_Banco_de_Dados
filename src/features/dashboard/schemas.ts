import { z } from "zod";

/** Filtro rápido de status: cada valor vale para a lista daquele módulo. */
export const DASHBOARD_STATUSES = [
  "BILL_TO_PAY",
  "BILL_OVERDUE",
  "BILL_PAID",
  "INVOICE_PENDING",
  "TICKET_OPEN",
  "QUOTE_PENDING",
  "CONTRACT_ACTIVE",
] as const;

export type DashboardStatus = (typeof DASHBOARD_STATUSES)[number];

export const dashboardFiltersSchema = z.object({
  status: z.enum(DASHBOARD_STATUSES).optional(),
  supplierId: z.string().min(1).optional(),
  sectorId: z.string().min(1).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export type DashboardFilters = z.infer<typeof dashboardFiltersSchema>;
