import "server-only";
import { db } from "@/lib/db";
import { isSafeFileKey } from "@/lib/upload-guard";
import type { AttachmentCategoryKey } from "@/lib/storage-keys";

export async function putFileBlob(opts: {
  fileKey: string;
  data: Buffer | Uint8Array;
  fileType: string;
  fileSize: number;
  category: AttachmentCategoryKey;
}) {
  if (!isSafeFileKey(opts.fileKey, opts.category)) {
    throw new Error("Caminho de arquivo inválido.");
  }
  const data = Buffer.from(opts.data);
  await db.fileBlob.create({
    data: {
      fileKey: opts.fileKey,
      data,
      fileType: opts.fileType,
      fileSize: opts.fileSize,
    },
  });
}

export async function headFileBlob(fileKey: string) {
  const blob = await db.fileBlob.findUnique({
    where: { fileKey },
    select: { fileSize: true, fileType: true },
  });
  if (!blob) return null;
  return { size: blob.fileSize, contentType: blob.fileType };
}

export async function getFileBlob(fileKey: string) {
  return db.fileBlob.findUnique({ where: { fileKey } });
}

export async function getFileBlobText(fileKey: string) {
  const blob = await getFileBlob(fileKey);
  if (!blob) return "";
  return Buffer.from(blob.data).toString("utf8");
}

export async function pingFileStorage() {
  await db.fileBlob.findFirst({ select: { fileKey: true } });
}
