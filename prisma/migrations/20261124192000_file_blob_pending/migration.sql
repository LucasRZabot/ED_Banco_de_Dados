-- Blobs órfãos expiram; só permanecem os anexados a um registro.
ALTER TABLE "file_blobs" ADD COLUMN "uploadedById" TEXT;
ALTER TABLE "file_blobs" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "file_blobs" ADD COLUMN "attachedAt" TIMESTAMP(3);

CREATE INDEX "file_blobs_expiresAt_idx" ON "file_blobs"("expiresAt");
CREATE INDEX "file_blobs_uploadedById_attachedAt_idx" ON "file_blobs"("uploadedById", "attachedAt");
