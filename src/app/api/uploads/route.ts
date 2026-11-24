import { z } from "zod";
import { putFileBlob } from "@/lib/blobs";
import { authenticateRequest } from "@/lib/dal";
import { env } from "@/lib/env";
import { clientKeyFromHeaders, uploadLimiter } from "@/lib/rate-limit";
import {
  ATTACHMENT_CATEGORIES,
  buildFileKey,
  canUploadCategory,
  isAllowedMime,
} from "@/lib/storage-keys";
import { createUploadToken } from "@/lib/upload-token";

const TOKEN_TTL_SECONDS = 60 * 60;

const metaSchema = z.object({
  category: z.enum(ATTACHMENT_CATEGORIES),
  referenceDate: z.iso.date().optional(),
});

function mimeFromFile(file: File) {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".xml")) return "application/xml";
  return file.type;
}

export async function POST(request: Request) {
  const { user, error } = await authenticateRequest();
  if (error) return error;
  const limitKey = `upload:${user.id}:${clientKeyFromHeaders(request.headers)}`;
  if (!uploadLimiter.take(limitKey)) {
    return Response.json({ error: "Muitas tentativas de upload. Aguarde um minuto." }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) {
    return Response.json({ error: "Dados do arquivo inválidos." }, { status: 400 });
  }

  const parsed = metaSchema.safeParse({
    category: form.get("category"),
    referenceDate: form.get("referenceDate") || undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "Dados do arquivo inválidos." }, { status: 400 });
  }

  const { category, referenceDate } = parsed.data;
  const fileName = file.name.trim().slice(0, 200) || "arquivo";
  const fileType = mimeFromFile(file);
  const fileSize = file.size;
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
  const data = Buffer.from(await file.arrayBuffer());
  await putFileBlob({ fileKey, data, fileType, fileSize });
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

  return Response.json({ fileKey, uploadToken });
}
