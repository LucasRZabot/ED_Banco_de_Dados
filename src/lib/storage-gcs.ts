import "server-only";
import { Storage } from "@google-cloud/storage";
import { envGcs } from "@/lib/env";

let client: Storage | undefined;

function gcs() {
  client ??= new Storage();
  return client;
}

function bucket() {
  const e = envGcs();
  return gcs().bucket(e.GCS_BUCKET);
}

function isNotFound(err: unknown) {
  const code = (err as { code?: number | string }).code;
  return code === 404 || code === "404";
}

export async function presignUpload(key: string, contentType: string) {
  const e = envGcs();
  const [url] = await bucket()
    .file(key)
    .getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + e.STORAGE_PRESIGN_EXPIRES_SECONDS * 1000,
      contentType,
    });
  return url;
}

export async function presignDownload(
  key: string,
  fileName: string,
  contentType: string,
  opts: { disposition?: "inline" | "attachment" } = {},
) {
  const e = envGcs();
  const safeAscii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const kind = opts.disposition ?? "inline";
  const [url] = await bucket()
    .file(key)
    .getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + e.STORAGE_PRESIGN_EXPIRES_SECONDS * 1000,
      responseType: contentType,
      responseDisposition: `${kind}; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    });
  return url;
}

export async function getObjectText(key: string) {
  const [buf] = await bucket().file(key).download();
  return buf.toString("utf8");
}

export async function headBucket() {
  const [exists] = await bucket().exists();
  if (!exists) throw new Error(`Bucket GCS ${envGcs().GCS_BUCKET} não encontrado.`);
}

export async function headObject(key: string) {
  try {
    const [metadata] = await bucket().file(key).getMetadata();
    return { size: Number(metadata.size ?? 0), contentType: metadata.contentType ?? "" };
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}
