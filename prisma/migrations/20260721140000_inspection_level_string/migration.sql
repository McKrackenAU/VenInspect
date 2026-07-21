-- Redefine Inspection.level from enum to TEXT so admin can add custom types.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

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
    CONSTRAINT "Inspection_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Inspection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inspection_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Inspection_parentInspectionId_fkey" FOREIGN KEY ("parentInspectionId") REFERENCES "Inspection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Inspection" (
  "id", "assetId", "level", "status", "inspectedAt", "createdAt", "updatedAt",
  "submittedAt", "approvedAt", "generalComments", "createdById", "approvedById",
  "requiresLevel2Approval", "folderKey", "titleLabel", "relationKind", "parentInspectionId"
)
SELECT
  "id", "assetId", "level", "status", "inspectedAt", "createdAt", "updatedAt",
  "submittedAt", "approvedAt", "generalComments", "createdById", "approvedById",
  "requiresLevel2Approval", "folderKey", "titleLabel", "relationKind", "parentInspectionId"
FROM "Inspection";

DROP TABLE "Inspection";
ALTER TABLE "new_Inspection" RENAME TO "Inspection";

CREATE INDEX "Inspection_assetId_submittedAt_idx" ON "Inspection"("assetId", "submittedAt");
CREATE INDEX "Inspection_folderKey_idx" ON "Inspection"("folderKey");
CREATE INDEX "Inspection_parentInspectionId_idx" ON "Inspection"("parentInspectionId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
