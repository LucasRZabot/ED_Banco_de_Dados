import { z } from "zod";
import { authenticateRequest } from "@/lib/dal";
import { env } from "@/lib/env";
import { presignUpload } from "@/lib/s3";
import {
  ATTACHMENT_CATEGORIES,
  buildFileKey,
  canUploadCategory,
  isAllowedMime,
} from "@/lib/storage-keys";
import { createUploadToken } from "@/lib/upload-token";

// Tempo para o usuário terminar o formulário depois do upload; a URL de PUT expira antes.
const TOKEN_TTL_SECONDS = 60 * 60;

const bodySchema = z.object({
  category: z.enum(ATTACHMENT_CATEGORIES),
  fileName: z.string().trim().min(1).max(200),
  fileType: z.string().min(1).max(100),
  fileSize: z.number().int().positive(),
  referenceDate: z.iso.date().optional(),
});

export async function POST(request: Request) {
  const { user, error } = await authenticateRequest();
  if (error) return error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Dados do arquivo inválidos." }, { status: 400 });
  }
  const { category, fileName, fileType, fileSize, referenceDate } = parsed.data;
  const e = env();

  if (!canUploadCategory(user.role, category)) {
    return Response.json({ error: "Sem permissão para este tipo de anexo." }, { status: 403 });
  }
  if (!isAllowedMime(category, fileType)) {
    return Response.json({ error: "Tipo de arquivo não permitido." }, { status: 415 });
  }
  if (fileSize > e.UPLOAD_MAX_SIZE_MB * 1024 * 1024) {
    return Response.json({ error: `Arquivo acima de ${e.UPLOAD_MAX_SIZE_MB} MB.` }, { status: 413 });
  }

  const fileKey = buildFileKey({
    category,
    mimeType: fileType,
    referenceDate: referenceDate ? new Date(`${referenceDate}T12:00:00Z`) : undefined,
    timeZone: e.APP_TIMEZONE,
  });
  const uploadUrl = await presignUpload(fileKey, fileType);
  const uploadToken = createUploadToken(
    {
      key: fileKey,
      userId: user.id,
      category,
      fileName,
      fileType,
      fileSize,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    },
    e.AUTH_SECRET,
  );

  return Response.json({
    uploadUrl,
    method: "PUT",
    headers: { "Content-Type": fileType },
    fileKey,
    uploadToken,
  });
}
