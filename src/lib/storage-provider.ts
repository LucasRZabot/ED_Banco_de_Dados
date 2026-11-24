export type StorageProvider = "s3" | "gcs";

/** Bucket padrão do Firebase Storage, se o App Hosting injetar FIREBASE_CONFIG. */
export function storageBucketFromFirebaseConfig(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as { storageBucket?: unknown };
    return typeof parsed.storageBucket === "string" && parsed.storageBucket.trim()
      ? parsed.storageBucket.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * `gcs` em produção (Firebase Storage). `s3` no docker compose local (moto).
 * Sem STORAGE_PROVIDER, infere pelo bucket GCS / FIREBASE_CONFIG.
 */
export function resolveStorageProvider(env: NodeJS.Dict<string>): StorageProvider {
  const explicit = env.STORAGE_PROVIDER?.trim();
  if (explicit === "s3" || explicit === "gcs") return explicit;
  if (env.GCS_BUCKET?.trim()) return "gcs";
  if (storageBucketFromFirebaseConfig(env.FIREBASE_CONFIG)) return "gcs";
  return "s3";
}
