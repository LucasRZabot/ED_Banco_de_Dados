import { putFileBlob } from "@/lib/blobs";
import { env } from "@/lib/env";
import { buildFileKey, type AttachmentCategoryKey } from "@/lib/storage-keys";
import { createUploadToken } from "@/lib/upload-token";

export async function uploadBlob(opts: {
  userId: string;
  category: AttachmentCategoryKey;
  data: Buffer;
  fileName: string;
  fileType?: string;
  size?: number;
}) {
  const fileType = opts.fileType ?? "application/pdf";
  const key = buildFileKey({ category: opts.category, mimeType: fileType, timeZone: env().APP_TIMEZONE });
  await putFileBlob({
    fileKey: key,
    data: opts.data,
    fileType,
    fileSize: opts.data.length,
    category: opts.category,
  });
  const token = createUploadToken(
    {
      key,
      userId: opts.userId,
      category: opts.category,
      fileName: opts.fileName,
      fileType,
      fileSize: opts.size ?? opts.data.length,
      exp: Math.floor(Date.now() / 1000) + 600,
    },
    env().AUTH_SECRET,
  );
  return { key, token };
}
