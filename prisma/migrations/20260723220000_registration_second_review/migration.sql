-- AlterTable
ALTER TABLE "User" ADD COLUMN "registrationNumber" TEXT;

-- CreateTable ReviewStatus is string enum in SQLite via Prisma
-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Inspection" ADD COLUMN "reviewRequestedFromId" TEXT;
ALTER TABLE "Inspection" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "Inspection" ADD COLUMN "reviewedAt" DATETIME;
ALTER TABLE "Inspection" ADD COLUMN "reviewNote" TEXT;

-- CreateIndex
CREATE INDEX "Inspection_reviewStatus_reviewRequestedFromId_idx" ON "Inspection"("reviewStatus", "reviewRequestedFromId");
