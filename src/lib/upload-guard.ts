import { keyMatchesCategory, type AttachmentCategoryKey } from "@/lib/storage-keys";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

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

function looksLikeXml(buf: Buffer) {
  let text = buf.subarray(0, 256).toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const start = text.trimStart();
  return start.startsWith("<?xml") || (start.startsWith("<") && !start.toLowerCase().startsWith("<html"));
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
