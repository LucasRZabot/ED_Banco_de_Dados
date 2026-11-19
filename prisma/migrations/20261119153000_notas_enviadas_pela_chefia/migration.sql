-- AlterEnum
BEGIN;
CREATE TYPE "InvoiceStatus_new" AS ENUM ('PENDING', 'POSTED', 'CANCELED');
ALTER TABLE "public"."invoices" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "invoices" ALTER COLUMN "status" TYPE "InvoiceStatus_new" USING ("status"::text::"InvoiceStatus_new");
ALTER TYPE "InvoiceStatus" RENAME TO "InvoiceStatus_old";
ALTER TYPE "InvoiceStatus_new" RENAME TO "InvoiceStatus";
DROP TYPE "public"."InvoiceStatus_old";
ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_createdById_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_supplierId_fkey";

-- DropIndex
DROP INDEX "invoices_status_idx";

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "createdById",
ADD COLUMN     "postedAt" TIMESTAMP(3),
ADD COLUMN     "postedById" TEXT,
ADD COLUMN     "submittedById" TEXT NOT NULL,
ALTER COLUMN "number" DROP NOT NULL,
ALTER COLUMN "series" DROP NOT NULL,
ALTER COLUMN "series" DROP DEFAULT,
ALTER COLUMN "supplierId" DROP NOT NULL,
ALTER COLUMN "issueDate" DROP NOT NULL,
ALTER COLUMN "amount" DROP NOT NULL,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "invoices_submittedById_createdAt_idx" ON "invoices"("submittedById", "createdAt");

-- CreateIndex
CREATE INDEX "invoices_status_createdAt_idx" ON "invoices"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Descrição obrigatória e não vazia: a chefia explica do que se trata a nota
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_description_chk"
  CHECK (btrim("description") <> '');

-- Lançada (POSTED) só com os dados fiscais preenchidos pelo FINANCEIRO
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_posted_fields_chk"
  CHECK ("status" <> 'POSTED' OR (
    "number" IS NOT NULL AND "series" IS NOT NULL AND "supplierId" IS NOT NULL
    AND "issueDate" IS NOT NULL AND "amount" IS NOT NULL
    AND "postedById" IS NOT NULL AND "postedAt" IS NOT NULL
  ));
