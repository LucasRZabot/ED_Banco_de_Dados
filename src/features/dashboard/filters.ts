import { parseDateOnly, toDateInputValue } from "@/lib/dates";
import { DASHBOARD_STATUS_LIST, type DashboardListKind } from "./labels";
import { dashboardFiltersSchema, type DashboardFilters, type DashboardStatus } from "./schemas";

export type DateBounds = {
  gte?: Date;
  lte?: Date;
  gt?: Date;
  lt?: Date;
};

export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseDashboardFilters(raw: {
  status?: string | string[];
  supplierId?: string | string[];
  sectorId?: string | string[];
  from?: string | string[];
  to?: string | string[];
}): DashboardFilters {
  const parsed = dashboardFiltersSchema.safeParse({
    status: firstParam(raw.status) || undefined,
    supplierId: firstParam(raw.supplierId) || undefined,
    sectorId: firstParam(raw.sectorId) || undefined,
    from: firstParam(raw.from) || undefined,
    to: firstParam(raw.to) || undefined,
  });
  return parsed.success ? parsed.data : {};
}

export function withQuery(path: string, params: Record<string, string | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) sp.set(key, value);
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

export function ymdInRange(ymd: string, from?: string, to?: string) {
  if (from && ymd < from) return false;
  if (to && ymd > to) return false;
  return true;
}

/** Interseção de um intervalo [windowFrom, windowTo] com o filtro de período. */
export function clampYmdRange(
  windowFrom: string,
  windowTo: string,
  from?: string,
  to?: string,
): { from: string; to: string } | null {
  const start = from && from > windowFrom ? from : windowFrom;
  const end = to && to < windowTo ? to : windowTo;
  if (start > end) return null;
  return { from: start, to: end };
}

export function dateOnlyBound(value: string | undefined, endOfDay: boolean) {
  if (!value) return undefined;
  return endOfDay ? new Date(`${value}T23:59:59.999Z`) : parseDateOnly(value);
}

export function tightenDateFilter(base: DateBounds, from?: string, to?: string): DateBounds {
  const extraGte = dateOnlyBound(from, false);
  const extraLte = dateOnlyBound(to, true);
  const gteCandidates = [base.gte, extraGte].filter((d): d is Date => !!d);
  const lteCandidates = [base.lte, extraLte].filter((d): d is Date => !!d);
  return {
    gt: base.gt,
    lt: base.lt,
    gte: gteCandidates.length ? new Date(Math.max(...gteCandidates.map((d) => d.getTime()))) : undefined,
    lte: lteCandidates.length ? new Date(Math.min(...lteCandidates.map((d) => d.getTime()))) : undefined,
  };
}

export function rangeIsImpossible(bounds: DateBounds) {
  const lower = bounds.gte ?? (bounds.gt ? new Date(bounds.gt.getTime() + 1) : undefined);
  const upper = bounds.lte ?? (bounds.lt ? new Date(bounds.lt.getTime() - 1) : undefined);
  return !!(lower && upper && lower > upper);
}

export function relevantLists(status?: DashboardStatus): Set<DashboardListKind> {
  if (!status) return new Set(["bills", "invoices", "tickets", "quotes", "contracts"]);
  return new Set([DASHBOARD_STATUS_LIST[status]]);
}

export function csvCell(value: string) {
  let s = value.replaceAll('"', '""');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[;"\r\n]/.test(s) || s.startsWith("'")) return `"${s}"`;
  return s;
}

export type DashboardCsvRow = {
  tipo: string;
  vencimento: string;
  fornecedor: string;
  setor: string;
  valor: string;
  status: string;
  titulo: string;
};

export function buildDashboardCsv(rows: DashboardCsvRow[]) {
  const header = ["tipo", "vencimento", "fornecedor", "setor", "valor", "status", "titulo"] as const;
  const lines = [
    header.join(";"),
    ...rows.map((row) => header.map((key) => csvCell(row[key])).join(";")),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function todayYmd(today: Date) {
  return toDateInputValue(today);
}
