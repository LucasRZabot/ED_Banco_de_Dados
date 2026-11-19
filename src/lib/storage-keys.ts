import { randomUUID } from "node:crypto";
import type { AppRole } from "@/lib/roles";

export const ATTACHMENT_CATEGORIES = [
  "TICKET",
  "COMMENT",
  "QUOTE",
  "INVOICE_PDF",
  "INVOICE_XML",
  "BILL",
  "BILL_PAYMENT_PROOF",
  "CONTRACT",
] as const;
export type AttachmentCategoryKey = (typeof ATTACHMENT_CATEGORIES)[number];

const PDF = "application/pdf";
const IMAGES = ["image/png", "image/jpeg"];
const XML = ["application/xml", "text/xml"];

type CategoryPolicy = {
  prefix: "notas-fiscais" | "boletos" | "orcamentos" | "contratos" | "chamados";
  datedPrefix: boolean;
  mimeTypes: readonly string[];
  roles: readonly AppRole[];
  suffix?: string;
};

export const CATEGORY_POLICY: Record<AttachmentCategoryKey, CategoryPolicy> = {
  TICKET: { prefix: "chamados", datedPrefix: false, mimeTypes: [PDF, ...IMAGES], roles: ["FINANCEIRO", "REQUESTER"] },
  COMMENT: { prefix: "chamados", datedPrefix: false, mimeTypes: [PDF, ...IMAGES], roles: ["FINANCEIRO", "REQUESTER"] },
  QUOTE: { prefix: "orcamentos", datedPrefix: false, mimeTypes: [PDF, ...IMAGES], roles: ["FINANCEIRO"] },
  INVOICE_PDF: { prefix: "notas-fiscais", datedPrefix: true, mimeTypes: [PDF], roles: ["FINANCEIRO", "REQUESTER"] },
  INVOICE_XML: { prefix: "notas-fiscais", datedPrefix: true, mimeTypes: XML, roles: ["FINANCEIRO", "REQUESTER"] },
  BILL: { prefix: "boletos", datedPrefix: true, mimeTypes: [PDF], roles: ["FINANCEIRO"] },
  BILL_PAYMENT_PROOF: {
    prefix: "boletos",
    datedPrefix: true,
    mimeTypes: [PDF, ...IMAGES],
    roles: ["FINANCEIRO"],
    suffix: "-comprovante",
  },
  CONTRACT: { prefix: "contratos", datedPrefix: false, mimeTypes: [PDF], roles: ["FINANCEIRO"] },
};

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "application/xml": "xml",
  "text/xml": "xml",
  "image/png": "png",
  "image/jpeg": "jpg",
};

export function canUploadCategory(role: AppRole, category: AttachmentCategoryKey) {
  return CATEGORY_POLICY[category].roles.includes(role);
}

export function isAllowedMime(category: AttachmentCategoryKey, mime: string) {
  return CATEGORY_POLICY[category].mimeTypes.includes(mime);
}

function yearMonth(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}/${get("month")}`;
}

/**
 * Gera a key do objeto. O nome original nunca entra na key (fica só no banco),
 * evitando caracteres problemáticos e vazamento de informação pelo caminho.
 * `referenceDate` define YYYY/MM nos prefixos datados (emissão da NF, vencimento do boleto).
 */
export function buildFileKey(opts: {
  category: AttachmentCategoryKey;
  mimeType: string;
  referenceDate?: Date;
  timeZone: string;
  id?: string;
}) {
  const policy = CATEGORY_POLICY[opts.category];
  const ext = EXTENSIONS[opts.mimeType];
  if (!ext) throw new Error(`Tipo de arquivo não suportado: ${opts.mimeType}`);
  const dated = policy.datedPrefix ? `${yearMonth(opts.referenceDate ?? new Date(), opts.timeZone)}/` : "";
  return `${policy.prefix}/${dated}${opts.id ?? randomUUID()}${policy.suffix ?? ""}.${ext}`;
}

export function keyMatchesCategory(key: string, category: AttachmentCategoryKey) {
  const policy = CATEGORY_POLICY[category];
  const dated = policy.datedPrefix ? String.raw`\d{4}/\d{2}/` : "";
  const re = new RegExp(
    `^${policy.prefix}/${dated}[0-9a-f-]{36}${policy.suffix ?? ""}\\.(pdf|xml|png|jpg)$`,
  );
  return re.test(key);
}
