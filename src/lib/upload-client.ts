import type { AttachmentCategoryKey } from "@/lib/storage-keys";

export type UploadedFile = {
  uploadToken: string;
  fileKey: string;
  fileName: string;
  fileType: string;
  fileSize: number;
};

function mimeFromName(file: File) {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".xml")) return "application/xml";
  return file.type;
}

/** Usado pelo navegador: envia o arquivo ao servidor autenticado (grava bytea no Postgres). */
export async function uploadFile(
  file: File,
  category: AttachmentCategoryKey,
  referenceDate?: string,
): Promise<UploadedFile> {
  const fileType = mimeFromName(file);
  const form = new FormData();
  form.set("file", file);
  form.set("category", category);
  if (referenceDate) form.set("referenceDate", referenceDate);

  const res = await fetch("/api/uploads", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Não foi possível enviar o arquivo.");

  return {
    uploadToken: data.uploadToken,
    fileKey: data.fileKey,
    fileName: file.name,
    fileType,
    fileSize: file.size,
  };
}
