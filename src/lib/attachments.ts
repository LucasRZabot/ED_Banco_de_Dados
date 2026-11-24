import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { canViewOwnSubmission } from "@/lib/access";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/dal";
import { env } from "@/lib/env";
import { headObject } from "@/lib/storage";
import { keyMatchesCategory, type AttachmentCategoryKey } from "@/lib/storage-keys";
import { verifyUploadToken } from "@/lib/upload-token";

export type AttachmentOwner =
  | { ticketId: string }
  | { commentId: string }
  | { quoteId: string }
  | { invoiceId: string }
  | { billId: string }
  | { contractId: string };

export class AttachmentError extends Error {}

/**
 * Converte um upload já enviado ao armazenamento (Firebase Storage / S3 local) em registro `Attachment`.
 * Chamada pelas server actions dos módulos (chamados, NFs, boletos...) ao salvar a entidade dona.
 */
export async function attachUploadedFile(
  uploadToken: string,
  user: Pick<CurrentUser, "id">,
  owner: AttachmentOwner,
  expected?: AttachmentCategoryKey[],
  tx: Prisma.TransactionClient = db,
) {
  const claims = verifyUploadToken(uploadToken, env().AUTH_SECRET);
  if (!claims) throw new AttachmentError("Upload inválido ou expirado. Envie o arquivo novamente.");
  if (claims.userId !== user.id) throw new AttachmentError("Upload pertence a outro usuário.");
  if (expected && !expected.includes(claims.category)) throw new AttachmentError("Categoria de anexo inválida.");
  if (!keyMatchesCategory(claims.key, claims.category)) throw new AttachmentError("Caminho do arquivo inválido.");

  const head = await headObject(claims.key);
  if (!head) throw new AttachmentError("Arquivo não encontrado no armazenamento. Envie novamente.");
  if (head.size !== claims.fileSize || head.size > env().UPLOAD_MAX_SIZE_MB * 1024 * 1024) {
    throw new AttachmentError("Tamanho do arquivo não confere com o declarado.");
  }
  if (head.contentType && head.contentType !== claims.fileType) {
    throw new AttachmentError("Tipo do arquivo não confere com o declarado.");
  }

  // `fileKey` é único: o mesmo token não gera dois anexos.
  return tx.attachment.create({
    data: {
      fileKey: claims.key,
      fileName: claims.fileName,
      fileType: claims.fileType,
      fileSize: claims.fileSize,
      category: claims.category,
      uploadedById: user.id,
      ...owner,
    },
  });
}

/** FINANCEIRO vê qualquer anexo; a chefia só os que ela mesma enviou; ADMIN nenhum. */
export async function canViewAttachment(user: CurrentUser, attachmentId: string) {
  const att = await db.attachment.findUnique({ where: { id: attachmentId } });
  if (!att) return { attachment: null, allowed: false };
  return { attachment: att, allowed: canViewOwnSubmission(user, att.uploadedById) };
}
