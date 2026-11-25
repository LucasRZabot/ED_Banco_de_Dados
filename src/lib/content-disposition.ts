import { isXmlType } from "@/lib/upload-guard";

export function contentDisposition(fileName: string, kind: "inline" | "attachment" = "inline") {
  const safeAscii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** XML nunca é inline nem `text/xml`/`application/xml` — o navegador não deve parsear como HTML. */
export function fileDownloadHeaders(opts: { fileName: string; fileType: string; download?: boolean }) {
  const xml = isXmlType(opts.fileType);
  return {
    "Content-Type": xml ? "application/octet-stream" : opts.fileType,
    "Content-Disposition": contentDisposition(opts.fileName, xml || opts.download ? "attachment" : "inline"),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'; script-src 'none'; object-src 'none'",
  };
}
