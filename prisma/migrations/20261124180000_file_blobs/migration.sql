-- Anexos passam a viver no Postgres (bytea). Sem URL pública.
CREATE TABLE "file_blobs" (
    "fileKey" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_blobs_pkey" PRIMARY KEY ("fileKey")
);
