-- User names
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

-- Soft delete
ALTER TABLE "Inspection" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Inspection" ADD COLUMN "deletedById" TEXT;

-- Defect expansions
ALTER TABLE "Defect" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Defect" ADD COLUMN "groupName" TEXT;
ALTER TABLE "Defect" ADD COLUMN "groupNumber" TEXT;
ALTER TABLE "Defect" ADD COLUMN "componentNumber" TEXT;
ALTER TABLE "Defect" ADD COLUMN "wideningSide" TEXT;
ALTER TABLE "Defect" ADD COLUMN "wideningNumber" TEXT;
ALTER TABLE "Defect" ADD COLUMN "locationDetail" TEXT;
ALTER TABLE "Defect" ADD COLUMN "defectQty" REAL;
ALTER TABLE "Defect" ADD COLUMN "defectUnit" TEXT;
ALTER TABLE "Defect" ADD COLUMN "treatmentType" TEXT;
ALTER TABLE "Defect" ADD COLUMN "treatmentTimeframe" TEXT;
ALTER TABLE "Defect" ADD COLUMN "taskTypeId" TEXT;

CREATE TABLE "DefectPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "defectId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "caption" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DefectPhoto_defectId_fkey" FOREIGN KEY ("defectId") REFERENCES "Defect" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DefectPhoto_defectId_sortOrder_idx" ON "DefectPhoto"("defectId", "sortOrder");

CREATE TABLE "DefectTaskType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "DefectTaskType_code_key" ON "DefectTaskType"("code");

CREATE TABLE "DefectMappingOverlay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspectionId" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "pinsJson" TEXT NOT NULL DEFAULT '[]',
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DefectMappingOverlay_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DefectMappingOverlay_inspectionId_idx" ON "DefectMappingOverlay"("inspectionId");

CREATE TABLE "AssetAttributeSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetAttributeSnapshot_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetAttributeSnapshot_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AssetAttributeSnapshot_assetId_kind_createdAt_idx" ON "AssetAttributeSnapshot"("assetId", "kind", "createdAt");

CREATE INDEX "Defect_inspectionId_sortOrder_idx" ON "Defect"("inspectionId", "sortOrder");
CREATE INDEX "Defect_taskTypeId_idx" ON "Defect"("taskTypeId");
CREATE INDEX "Inspection_deletedAt_idx" ON "Inspection"("deletedAt");

-- Seed default task types
INSERT INTO "DefectTaskType" ("id", "code", "label", "sortOrder", "active", "createdAt") VALUES
  ('task_rm', 'RM', 'RM', 0, 1, CURRENT_TIMESTAMP),
  ('task_investigate', 'INVESTIGATE', 'Investigate', 1, 1, CURRENT_TIMESTAMP),
  ('task_monitor', 'MONITOR', 'Monitor', 2, 1, CURRENT_TIMESTAMP),
  ('task_fmrp', 'FMRP', 'FMRP task', 3, 1, CURRENT_TIMESTAMP);

-- Backfill DefectPhoto from legacy photoPath / comparisonPhotoPath
INSERT INTO "DefectPhoto" ("id", "defectId", "path", "caption", "kind", "sortOrder", "createdAt")
SELECT lower(hex(randomblob(12))), "id", "photoPath", NULL, 'overview', 0, CURRENT_TIMESTAMP
FROM "Defect" WHERE "photoPath" IS NOT NULL AND "photoPath" != '';

INSERT INTO "DefectPhoto" ("id", "defectId", "path", "caption", "kind", "sortOrder", "createdAt")
SELECT lower(hex(randomblob(12))), "id", "comparisonPhotoPath", 'Comparison', 'other', 1, CURRENT_TIMESTAMP
FROM "Defect" WHERE "comparisonPhotoPath" IS NOT NULL AND "comparisonPhotoPath" != '';
