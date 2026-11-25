import { keyMatchesCategory, type AttachmentCategoryKey } from "@/lib/storage-keys";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const PENDING_QUOTA_BYTES = 30 * 1024 * 1024;
export const PENDING_MAX_FILES = 20;
export const PENDING_TTL_MS = 60 * 60 * 1000;

export function sanitizeOriginalName(name: string) {
  const base = name.replaceAll("\\", "/").split("/").filter(Boolean).pop() ?? "arquivo";
  const cleaned = base
    .replace(/[\u0000-\u001f<>:"|?*]/g, "_")
    .replace(/^\.+/g, "")
    .trim()
    .slice(0, 180);
  return cleaned || "arquivo";
}

function looksLikePdf(buf: Buffer) {
  return buf.subarray(0, 5).toString("latin1") === "%PDF-";
}

function looksLikePng(buf: Buffer) {
  return buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
}

function looksLikeJpeg(buf: Buffer) {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

function xmlText(buf: Buffer) {
  let text = buf.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

function looksLikeUnsafeMarkup(text: string) {
  const lower = text.toLowerCase();
  return (
    lower.includes("<html") ||
    lower.includes("<xhtml") ||
    lower.includes("xhtml=") ||
    lower.includes("<svg") ||
    lower.includes("<script") ||
    lower.includes("javascript:") ||
    /xmlns\s*=\s*["'][^"']*xhtml/i.test(text)
  );
}

function looksLikeXml(buf: Buffer) {
  const text = xmlText(buf);
  const start = text.trimStart();
  if (!start.startsWith("<?xml")) return false;
  return !looksLikeUnsafeMarkup(text);
}

export function stripUnsafeXml(buf: Buffer) {
  let text = xmlText(buf);
  text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<\?.*?\?>/g, (pi) => (pi.toLowerCase().includes("xml") ? pi : ""));
  text = text.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  text = text.replace(/javascript:/gi, "");
  if (looksLikeUnsafeMarkup(text) || !text.trimStart().startsWith("<?xml")) return null;
  return Buffer.from(text, "utf8");
}

/** Confere o conteúdo real com o MIME declarado (PDF, XML, PNG, JPEG). */
export function sniffedMime(buf: Buffer, claimed: string) {
  if (claimed === "application/pdf" && looksLikePdf(buf)) return claimed;
  if ((claimed === "application/xml" || claimed === "text/xml") && looksLikeXml(buf)) return claimed;
  if (claimed === "image/png" && looksLikePng(buf)) return claimed;
  if (claimed === "image/jpeg" && looksLikeJpeg(buf)) return claimed;
  return null;
}

export function isSafeFileKey(key: string, category: AttachmentCategoryKey) {
  if (!key || key.includes("..") || key.includes("\\") || key.startsWith("/") || key.includes("\0")) return false;
  return keyMatchesCategory(key, category);
}

export function isXmlType(fileType: string) {
  return fileType === "application/xml" || fileType === "text/xml";
}
