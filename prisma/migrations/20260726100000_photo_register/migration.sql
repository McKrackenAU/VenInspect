-- AlterTable
ALTER TABLE "DefectPhoto" ADD COLUMN "takenAt" DATETIME;

-- Backfill capture date from row creation time for existing photos
UPDATE "DefectPhoto" SET "takenAt" = "createdAt" WHERE "takenAt" IS NULL;

-- CreateTable
CREATE TABLE "PhotoRegisterEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspectionId" TEXT NOT NULL,
    "photoKey" TEXT NOT NULL,
    "takenAt" DATETIME NOT NULL,
    "registerNo" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    CONSTRAINT "PhotoRegisterEntry_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PhotoRegisterEntry_inspectionId_photoKey_key" ON "PhotoRegisterEntry"("inspectionId", "photoKey");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoRegisterEntry_inspectionId_registerNo_key" ON "PhotoRegisterEntry"("inspectionId", "registerNo");

-- CreateIndex
CREATE INDEX "PhotoRegisterEntry_inspectionId_sortOrder_idx" ON "PhotoRegisterEntry"("inspectionId", "sortOrder");
