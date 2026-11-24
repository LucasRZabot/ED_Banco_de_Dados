import { describe, expect, it } from "vitest";
import { resolveStorageProvider, storageBucketFromFirebaseConfig } from "@/lib/storage-provider";

describe("resolveStorageProvider", () => {
  it("respeita STORAGE_PROVIDER explícito", () => {
    expect(resolveStorageProvider({ STORAGE_PROVIDER: "gcs" })).toBe("gcs");
    expect(resolveStorageProvider({ STORAGE_PROVIDER: "s3", GCS_BUCKET: "x.appspot.com" })).toBe("s3");
  });

  it("infere gcs pelo bucket ou FIREBASE_CONFIG", () => {
    expect(resolveStorageProvider({ GCS_BUCKET: "proj.firebasestorage.app" })).toBe("gcs");
    expect(
      resolveStorageProvider({
        FIREBASE_CONFIG: JSON.stringify({ projectId: "proj", storageBucket: "proj.firebasestorage.app" }),
      }),
    ).toBe("gcs");
  });

  it("cai no s3 local quando não há sinal de Firebase", () => {
    expect(resolveStorageProvider({ S3_BUCKET: "hospital-financeiro-anexos" })).toBe("s3");
  });
});

describe("storageBucketFromFirebaseConfig", () => {
  it("lê storageBucket e ignora JSON inválido", () => {
    expect(storageBucketFromFirebaseConfig('{"storageBucket":"p.firebasestorage.app"}')).toBe(
      "p.firebasestorage.app",
    );
    expect(storageBucketFromFirebaseConfig("not-json")).toBeUndefined();
    expect(storageBucketFromFirebaseConfig("{}")).toBeUndefined();
  });
});
