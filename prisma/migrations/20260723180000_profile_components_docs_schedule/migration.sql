-- Asset.type enum → TEXT; profileJson/componentsJson; documents; audit assignments; defect.componentId
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetNumber" TEXT NOT NULL,
    "assetVisionId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BRIDGE',
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
    "lastLevel1At" DATETIME,
    "lastLevel2At" DATETIME,
    "requireConfinedSpace" BOOLEAN NOT NULL DEFAULT false,
    "requireTrafficManagement" BOOLEAN NOT NULL DEFAULT false,
    "requireWorkingAtHeights" BOOLEAN NOT NULL DEFAULT false,
    "profileJson" TEXT,
    "componentsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_Asset" (
  "id", "assetNumber", "assetVisionId", "name", "type", "roadName", "location",
  "latitude", "longitude", "parentDirection", "parentChainage", "parentAssetCode",
  "parentAssetName", "classification", "notes", "level1IntervalYears", "level2IntervalYears",
  "lastLevel1At", "lastLevel2At", "requireConfinedSpace", "requireTrafficManagement",
  "requireWorkingAtHeights", "createdAt", "updatedAt"
)
SELECT
  "id", "assetNumber", "assetVisionId", "name", "type", "roadName", "location",
  "latitude", "longitude", "parentDirection", "parentChainage", "parentAssetCode",
  "parentAssetName", "classification", "notes", "level1IntervalYears", "level2IntervalYears",
  "lastLevel1At", "lastLevel2At", "requireConfinedSpace", "requireTrafficManagement",
  "requireWorkingAtHeights", "createdAt", "updatedAt"
FROM "Asset";

DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";

CREATE UNIQUE INDEX "Asset_assetNumber_key" ON "Asset"("assetNumber");
CREATE INDEX "Asset_roadName_assetNumber_idx" ON "Asset"("roadName", "assetNumber");
CREATE INDEX "Asset_assetVisionId_idx" ON "Asset"("assetVisionId");
CREATE INDEX "Asset_type_idx" ON "Asset"("type");

CREATE TABLE "AssetDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    "documentDate" DATETIME,
    "notes" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AssetDocument_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssetDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AssetDocument_assetId_idx" ON "AssetDocument"("assetId");

CREATE TABLE "AuditAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "inspectionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuditAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditAssignment_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AuditAssignment_assignedToId_status_dueDate_idx" ON "AuditAssignment"("assignedToId", "status", "dueDate");
CREATE INDEX "AuditAssignment_assetId_dueDate_idx" ON "AuditAssignment"("assetId", "dueDate");
CREATE INDEX "AuditAssignment_status_dueDate_idx" ON "AuditAssignment"("status", "dueDate");

CREATE TABLE "new_Defect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "defectCode" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "category" TEXT,
    "subcategory" TEXT,
    "componentId" TEXT,
    "description" TEXT NOT NULL,
    "comments" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "photoPath" TEXT,
    "comparisonPhotoPath" TEXT,
    "carriedFromDefectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Defect_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Defect" (
  "id", "defectCode", "inspectionId", "category", "subcategory", "description",
  "comments", "severity", "photoPath", "comparisonPhotoPath", "carriedFromDefectId",
  "createdAt", "updatedAt"
)
SELECT
  "id", "defectCode", "inspectionId", "category", "subcategory", "description",
  "comments", "severity", "photoPath", "comparisonPhotoPath", "carriedFromDefectId",
  "createdAt", "updatedAt"
FROM "Defect";

DROP TABLE "Defect";
ALTER TABLE "new_Defect" RENAME TO "Defect";

CREATE UNIQUE INDEX "Defect_inspectionId_defectCode_key" ON "Defect"("inspectionId", "defectCode");
CREATE INDEX "Defect_inspectionId_idx" ON "Defect"("inspectionId");
CREATE INDEX "Defect_componentId_idx" ON "Defect"("componentId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
