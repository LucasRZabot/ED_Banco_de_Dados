import "server-only";
import {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { envS3 } from "@/lib/env";

let client: S3Client | undefined;

/** Cliente S3 só para o moto local (docker compose). Produção usa Firebase Storage. */
export function s3() {
  if (!client) {
    const e = envS3();
    client = new S3Client({
      region: e.AWS_REGION,
      endpoint: e.S3_ENDPOINT,
      forcePathStyle: e.S3_FORCE_PATH_STYLE,
      credentials:
        e.AWS_ACCESS_KEY_ID && e.AWS_SECRET_ACCESS_KEY
          ? { accessKeyId: e.AWS_ACCESS_KEY_ID, secretAccessKey: e.AWS_SECRET_ACCESS_KEY }
          : undefined,
      // Sem isso o SDK assina um checksum CRC32 que o navegador não envia, e o PUT falha.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return client;
}

export async function presignUpload(key: string, contentType: string) {
  const e = envS3();
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: e.S3_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: e.STORAGE_PRESIGN_EXPIRES_SECONDS },
  );
}

export async function presignDownload(
  key: string,
  fileName: string,
  contentType: string,
  opts: { disposition?: "inline" | "attachment" } = {},
) {
  const e = envS3();
  const safeAscii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const kind = opts.disposition ?? "inline";
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: e.S3_BUCKET,
      Key: key,
      ResponseContentType: contentType,
      ResponseContentDisposition: `${kind}; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    }),
    { expiresIn: e.STORAGE_PRESIGN_EXPIRES_SECONDS },
  );
}

export async function getObjectText(key: string) {
  const res = await s3().send(new GetObjectCommand({ Bucket: envS3().S3_BUCKET, Key: key }));
  return res.Body ? await res.Body.transformToString() : "";
}

export async function headBucket() {
  await s3().send(new HeadBucketCommand({ Bucket: envS3().S3_BUCKET }));
}

export async function headObject(key: string) {
  try {
    const res = await s3().send(new HeadObjectCommand({ Bucket: envS3().S3_BUCKET, Key: key }));
    return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? "" };
  } catch (err) {
    if (err instanceof NotFound || (err as { name?: string }).name === "NotFound") return null;
    throw err;
  }
}
