import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  isSafeFileKey,
  PENDING_MAX_FILES,
  PENDING_QUOTA_BYTES,
  PENDING_TTL_MS,
} from "@/lib/upload-guard";
import type { AttachmentCategoryKey } from "@/lib/storage-keys";

export class BlobQuotaError extends Error {}

export async function sweepExpiredBlobs() {
  await db.fileBlob.deleteMany({
    where: { expiresAt: { not: null, lt: new Date() } },
  });
}

export async function putFileBlob(opts: {
  fileKey: string;
  data: Buffer | Uint8Array;
  fileType: string;
  fileSize: number;
  category: AttachmentCategoryKey;
  uploadedById: string;
}) {
  if (!isSafeFileKey(opts.fileKey, opts.category)) {
    throw new Error("Caminho de arquivo inválido.");
  }
  const data = Buffer.from(opts.data);
  await sweepExpiredBlobs();

  const pending = await db.fileBlob.aggregate({
    where: { uploadedById: opts.uploadedById, attachedAt: null },
    _count: true,
    _sum: { fileSize: true },
  });
  const pendingCount = pending._count;
  const pendingBytes = pending._sum.fileSize ?? 0;
  if (pendingCount >= PENDING_MAX_FILES || pendingBytes + data.length > PENDING_QUOTA_BYTES) {
    throw new BlobQuotaError("Cota de arquivos pendentes excedida. Salve o registro ou aguarde.");
  }

  await db.fileBlob.create({
    data: {
      fileKey: opts.fileKey,
      data,
      fileType: opts.fileType,
      fileSize: opts.fileSize,
      uploadedById: opts.uploadedById,
      expiresAt: new Date(Date.now() + PENDING_TTL_MS),
    },
  });
}

export async function markBlobAttached(fileKey: string, tx: Prisma.TransactionClient | typeof db = db) {
  await tx.fileBlob.update({
    where: { fileKey },
    data: { attachedAt: new Date(), expiresAt: null },
  });
}

export async function headFileBlob(fileKey: string) {
  const blob = await db.fileBlob.findUnique({
    where: { fileKey },
    select: { fileSize: true, fileType: true, expiresAt: true },
  });
  if (!blob) return null;
  if (blob.expiresAt && blob.expiresAt < new Date()) return null;
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
