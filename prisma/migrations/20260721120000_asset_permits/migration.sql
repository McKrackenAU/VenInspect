-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "requireConfinedSpace" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Asset" ADD COLUMN "requireTrafficManagement" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Asset" ADD COLUMN "requireWorkingAtHeights" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "InspectionPermitCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspectionId" TEXT NOT NULL,
    "permitKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "requiredOnAsset" BOOLEAN NOT NULL DEFAULT true,
    "willUse" BOOLEAN NOT NULL,
    "notNeededReason" TEXT,
    CONSTRAINT "InspectionPermitCheck_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "InspectionPermitCheck_inspectionId_permitKey_key" ON "InspectionPermitCheck"("inspectionId", "permitKey");
CREATE INDEX "InspectionPermitCheck_inspectionId_idx" ON "InspectionPermitCheck"("inspectionId");
