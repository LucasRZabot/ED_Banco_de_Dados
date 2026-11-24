import "server-only";
import { env } from "@/lib/env";
import * as gcs from "@/lib/storage-gcs";
import * as s3 from "@/lib/s3";

type Backend = typeof s3 | typeof gcs;

function backend(): Backend {
  return env().STORAGE_PROVIDER === "gcs" ? gcs : s3;
}

/** Gera URL assinada de PUT (S3 local ou Firebase Storage). */
export async function presignUpload(key: string, contentType: string) {
  return backend().presignUpload(key, contentType);
}

export async function presignDownload(
  key: string,
  fileName: string,
  contentType: string,
  opts: { disposition?: "inline" | "attachment" } = {},
) {
  return backend().presignDownload(key, fileName, contentType, opts);
}

export async function getObjectText(key: string) {
  return backend().getObjectText(key);
}

export async function headBucket() {
  return backend().headBucket();
}

export async function headObject(key: string) {
  return backend().headObject(key);
}
