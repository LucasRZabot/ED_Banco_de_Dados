/** Datas de negócio: sempre o calendário de `America/Sao_Paulo`, sem hora. */

export const APP_TIMEZONE = "America/Sao_Paulo";
export const MS_PER_DAY = 86_400_000;

const ymdFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD no fuso do hospital. */
export function ymdInTz(date = new Date(), timeZone = APP_TIMEZONE) {
  if (timeZone === APP_TIMEZONE) return ymdFmt.format(date);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Meia-noite UTC do dia civil em `timeZone` — comparável com colunas `@db.Date`. */
export function parseDateOnly(ymd: string) {
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function todayInTz(timeZone = APP_TIMEZONE) {
  return parseDateOnly(ymdInTz(new Date(), timeZone));
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function startOfNextMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

/** Dias até o vencimento: positivo = futuro, 0 = hoje, negativo = atrasado. */
export function daysUntil(due: Date, today: Date) {
  const a = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const b = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((a - b) / MS_PER_DAY);
}

export function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}
