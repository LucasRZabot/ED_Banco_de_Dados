import { z } from "zod";
import { BlobQuotaError, putFileBlob } from "@/lib/blobs";
import { authenticateRequest } from "@/lib/dal";
import { env } from "@/lib/env";
import { uploadLimiter } from "@/lib/rate-limit";
import {
  ATTACHMENT_CATEGORIES,
  buildFileKey,
  canUploadCategory,
  isAllowedMime,
} from "@/lib/storage-keys";
import { MAX_UPLOAD_BYTES, sanitizeOriginalName, sniffedMime, stripUnsafeXml } from "@/lib/upload-guard";
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
  return "";
}

export async function POST(request: Request) {
  const { user, error } = await authenticateRequest();
  if (error) return error;
  if (!uploadLimiter.take(`upload:${user.id}`)) {
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
  const fileName = sanitizeOriginalName(file.name);
  const claimedType = mimeFromFile(file);
  const e = env();
  const maxBytes = Math.min(e.UPLOAD_MAX_SIZE_MB * 1024 * 1024, MAX_UPLOAD_BYTES);

  if (!canUploadCategory(user.role, category)) {
    return Response.json({ error: "Sem permissão para este tipo de anexo." }, { status: 403 });
  }
  if (!claimedType || !isAllowedMime(category, claimedType)) {
    return Response.json({ error: "Tipo de arquivo não permitido." }, { status: 415 });
  }
  if (file.size < 1 || file.size > maxBytes) {
    return Response.json(
      { error: file.size < 1 ? "Arquivo vazio." : `Arquivo acima de ${e.UPLOAD_MAX_SIZE_MB} MB.` },
      { status: file.size < 1 ? 400 : 413 },
    );
  }

  let data = Buffer.from(await file.arrayBuffer());
  if (data.length < 1 || data.length > maxBytes) {
    return Response.json(
      { error: data.length < 1 ? "Arquivo vazio." : `Arquivo acima de ${e.UPLOAD_MAX_SIZE_MB} MB.` },
      { status: data.length < 1 ? 400 : 413 },
    );
  }
  const fileType = sniffedMime(data, claimedType);
  if (!fileType || !isAllowedMime(category, fileType)) {
    return Response.json({ error: "Conteúdo do arquivo não confere com o tipo permitido." }, { status: 415 });
  }
  if (fileType === "application/xml" || fileType === "text/xml") {
    const stripped = stripUnsafeXml(data);
    if (!stripped) {
      return Response.json({ error: "XML recusado: conteúdo inseguro." }, { status: 415 });
    }
    data = stripped;
  }

  const fileKey = buildFileKey({
    category,
    mimeType: fileType,
    referenceDate: referenceDate ? new Date(`${referenceDate}T12:00:00Z`) : undefined,
    timeZone: e.APP_TIMEZONE,
  });
  try {
    await putFileBlob({
      fileKey,
      data,
      fileType,
      fileSize: data.length,
      category,
      uploadedById: user.id,
    });
  } catch (err) {
    if (err instanceof BlobQuotaError) {
      return Response.json({ error: err.message }, { status: 413 });
    }
    throw err;
  }
  const uploadToken = createUploadToken(
    {
      key: fileKey,
      userId: user.id,
      category,
      fileName,
      fileType,
      fileSize: data.length,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    },
    e.AUTH_SECRET,
  );

  return Response.json({ fileKey, uploadToken });
}
