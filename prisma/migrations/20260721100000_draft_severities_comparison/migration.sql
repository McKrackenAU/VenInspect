-- Defect severity becomes free-text (admin-customisable); add comparison photo fields.
-- SQLite stores enums as TEXT already; recreate Defect table for new columns.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Defect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "defectCode" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "category" TEXT,
    "subcategory" TEXT,
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

INSERT INTO "new_Defect" ("id", "defectCode", "inspectionId", "category", "subcategory", "description", "comments", "severity", "photoPath", "createdAt", "updatedAt")
SELECT "id", "defectCode", "inspectionId", "category", "subcategory", "description", "comments", "severity", "photoPath", "createdAt", "updatedAt" FROM "Defect";

DROP TABLE "Defect";
ALTER TABLE "new_Defect" RENAME TO "Defect";

CREATE UNIQUE INDEX "Defect_inspectionId_defectCode_key" ON "Defect"("inspectionId", "defectCode");
CREATE INDEX "Defect_inspectionId_idx" ON "Defect"("inspectionId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
