const TZ = process.env.APP_TIMEZONE ?? "America/Sao_Paulo";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: TZ });
/** Colunas `@db.Date` ficam em meia-noite UTC; formatar em UTC evita virar o dia anterior em São Paulo. */
const dateOnlyFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: TZ,
});

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return dateFmt.format(value instanceof Date ? value : new Date(value));
}

export function formatDateOnly(value: Date | string | null | undefined) {
  if (!value) return "—";
  return dateOnlyFmt.format(value instanceof Date ? value : new Date(value));
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  return dateTimeFmt.format(value instanceof Date ? value : new Date(value));
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ticketCode(code: number) {
  return `#${code}`;
}

export function formatBRL(value: { toString(): string } | string | number | null | undefined) {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value.toString());
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

export function formatCnpjDisplay(value: string | null | undefined) {
  if (!value) return "—";
  const d = value.replace(/\D/g, "");
  if (d.length !== 14) return value;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/** 47 dígitos: 5.5 5.6 5.6 1 14. 48 dígitos: quatro blocos 11-1. */
export function formatDigitableLine(value: string | null | undefined) {
  if (!value) return "—";
  const d = value.replace(/\D/g, "");
  if (d.length === 47) {
    return `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d.slice(32, 33)} ${d.slice(33)}`;
  }
  if (d.length === 48) {
    const block = (i: number) => `${d.slice(i, i + 11)}-${d.slice(i + 11, i + 12)}`;
    return `${block(0)} ${block(12)} ${block(24)} ${block(36)}`;
  }
  return value;
}

export function parseMoney(raw: string) {
  const t = raw.trim().replace(/\s/g, "");
  if (!t) return null;
  const normalized = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
