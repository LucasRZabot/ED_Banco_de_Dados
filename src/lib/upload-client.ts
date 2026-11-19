import type { AttachmentCategoryKey } from "@/lib/storage-keys";

export type UploadedFile = {
  uploadToken: string;
  fileKey: string;
  fileName: string;
  fileType: string;
  fileSize: number;
};

/** Usado pelo navegador: pede a presigned URL e envia o arquivo direto ao S3. */
export async function uploadFile(
  file: File,
  category: AttachmentCategoryKey,
  referenceDate?: string,
): Promise<UploadedFile> {
  const res = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      referenceDate,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Não foi possível preparar o upload.");

  const put = await fetch(data.uploadUrl, { method: "PUT", headers: data.headers, body: file });
  if (!put.ok) throw new Error("Falha ao enviar o arquivo ao armazenamento.");

  return {
    uploadToken: data.uploadToken,
    fileKey: data.fileKey,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  };
}
