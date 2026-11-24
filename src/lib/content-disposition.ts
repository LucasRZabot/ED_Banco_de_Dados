export function contentDisposition(fileName: string, kind: "inline" | "attachment" = "inline") {
  const safeAscii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
