-- Asset roadName NOT NULL with default + indexes
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetNumber" TEXT NOT NULL,
    "assetVisionId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "roadName" TEXT NOT NULL DEFAULT 'Unknown Road',
    "location" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "parentDirection" TEXT,
    "parentChainage" REAL,
    "parentAssetCode" TEXT,
    "parentAssetName" TEXT,
    "classification" TEXT,
    "notes" TEXT,
    "level1IntervalYears" INTEGER NOT NULL DEFAULT 3,
    "level2IntervalYears" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_Asset" (
  "id", "assetNumber", "assetVisionId", "name", "type", "roadName", "location",
  "latitude", "longitude", "parentDirection", "parentChainage", "parentAssetCode",
  "parentAssetName", "classification", "notes", "level1IntervalYears",
  "level2IntervalYears", "createdAt", "updatedAt"
)
SELECT
  "id", "assetNumber", "assetVisionId", "name", "type",
  COALESCE(NULLIF("roadName", ''), "parentAssetName", 'Unknown Road'),
  "location", "latitude", "longitude", "parentDirection", "parentChainage",
  "parentAssetCode", "parentAssetName", "classification", "notes",
  "level1IntervalYears", "level2IntervalYears", "createdAt", "updatedAt"
FROM "Asset";

DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE UNIQUE INDEX "Asset_assetNumber_key" ON "Asset"("assetNumber");
CREATE INDEX "Asset_roadName_assetNumber_idx" ON "Asset"("roadName", "assetNumber");
CREATE INDEX "Asset_assetVisionId_idx" ON "Asset"("assetVisionId");
CREATE INDEX "Asset_type_idx" ON "Asset"("type");

-- Inspection: folderKey, titleLabel, relationKind, parentInspectionId; submittedAt NOT NULL
CREATE TABLE "new_Inspection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "inspectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    "generalComments" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "requiresLevel2Approval" BOOLEAN NOT NULL DEFAULT false,
    "folderKey" TEXT NOT NULL,
    "titleLabel" TEXT NOT NULL,
    "relationKind" TEXT NOT NULL DEFAULT 'STANDALONE',
    "parentInspectionId" TEXT,
    CONSTRAINT "new_Inspection_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "new_Inspection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "new_Inspection_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "new_Inspection_parentInspectionId_fkey" FOREIGN KEY ("parentInspectionId") REFERENCES "Inspection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Inspection" (
  "id", "assetId", "level", "status", "inspectedAt", "createdAt", "updatedAt",
  "submittedAt", "approvedAt", "generalComments", "createdById", "approvedById",
  "requiresLevel2Approval", "folderKey", "titleLabel", "relationKind", "parentInspectionId"
)
SELECT
  i."id",
  i."assetId",
  i."level",
  i."status",
  i."inspectedAt",
  i."createdAt",
  i."updatedAt",
  COALESCE(i."submittedAt", i."inspectedAt", i."createdAt"),
  i."approvedAt",
  i."generalComments",
  i."createdById",
  i."approvedById",
  i."requiresLevel2Approval",
  strftime('%d%m%Y', COALESCE(i."submittedAt", i."inspectedAt", i."createdAt")),
  (
    SELECT COALESCE(a."roadName", 'Unknown Road') || ' - ' || a."assetNumber" || ' - ' ||
      strftime('%d%m%Y', COALESCE(i."submittedAt", i."inspectedAt", i."createdAt"))
    FROM "Asset" a WHERE a."id" = i."assetId"
  ),
  'STANDALONE',
  NULL
FROM "Inspection" i;

DROP TABLE "Inspection";
ALTER TABLE "new_Inspection" RENAME TO "Inspection";
CREATE INDEX "Inspection_assetId_submittedAt_idx" ON "Inspection"("assetId", "submittedAt");
CREATE INDEX "Inspection_folderKey_idx" ON "Inspection"("folderKey");
CREATE INDEX "Inspection_parentInspectionId_idx" ON "Inspection"("parentInspectionId");
PRAGMA foreign_keys=ON;
