/**
 * Aplica CORS no bucket do Firebase Storage (GCS).
 * Rode com ADC local (`gcloud auth application-default login`), nunca cole chave de service account.
 * Em produção o bucket já existe ao ativar Storage no console; este script só libera PUT do APP_URL.
 */
import "dotenv/config";
import { Storage } from "@google-cloud/storage";
import { storageBucketFromFirebaseConfig } from "../src/lib/storage-provider";

const bucketName =
  process.env.GCS_BUCKET?.trim() || storageBucketFromFirebaseConfig(process.env.FIREBASE_CONFIG);
const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function main() {
  if (!bucketName) {
    throw new Error("Defina GCS_BUCKET (ex.: meu-projeto.firebasestorage.app).");
  }

  const storage = new Storage();
  const bucket = storage.bucket(bucketName);
  const [exists] = await bucket.exists();
  if (!exists) {
    throw new Error(
      `Bucket ${bucketName} não existe. No Firebase Console: Build → Storage → Get started (modo produção).`,
    );
  }

  const origins = [appUrl];
  if (appUrl !== "http://localhost:3000") origins.push("http://localhost:3000");

  await bucket.setCorsConfiguration([
    {
      origin: origins,
      method: ["GET", "HEAD", "PUT"],
      responseHeader: ["Content-Type", "Content-Disposition", "ETag"],
      maxAgeSeconds: 3600,
    },
  ]);
  console.log(`CORS do bucket ${bucketName} liberado para ${origins.join(", ")}.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
