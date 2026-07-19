-- AlterTable
ALTER TABLE "User" ADD COLUMN "microsoftOid" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_microsoftOid_key" ON "User"("microsoftOid");

-- RedefineTables
CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetNumber" TEXT NOT NULL,
    "assetVisionId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "roadName" TEXT,
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
  "id", "assetNumber", "name", "type", "roadName", "location", "latitude", "longitude",
  "level1IntervalYears", "level2IntervalYears", "createdAt", "updatedAt"
)
SELECT
  "id", "assetNumber", "name", "type", "roadName", "location", "latitude", "longitude",
  "level1IntervalYears", "level2IntervalYears", "createdAt", "updatedAt"
FROM "Asset";

DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";

CREATE UNIQUE INDEX "Asset_assetNumber_key" ON "Asset"("assetNumber");
CREATE INDEX "Asset_assetVisionId_idx" ON "Asset"("assetVisionId");
CREATE INDEX "Asset_type_idx" ON "Asset"("type");
