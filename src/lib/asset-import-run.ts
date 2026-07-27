import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { parseAssetWorkbook } from "@/lib/asset-import";

export type AssetImportResult = {
  created: number;
  updated: number;
  skipped: number;
  total: number;
  errors: string[];
};

/** Shared upsert loop for API import (bulk-friendly). */
export async function runAssetImport(
  buffer: Buffer,
  mode: string,
): Promise<AssetImportResult> {
  const { rows, errors } = parseAssetWorkbook(buffer);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const rowErrors = [...errors];

  // Prefetch existing codes once — much faster for ~200+ row imports.
  const codes = rows.map((r) => r.assetNumber);
  const existingRows =
    codes.length > 0
      ? await prisma.asset.findMany({
          where: { assetNumber: { in: codes } },
          select: { assetNumber: true },
        })
      : [];
  const existingSet = new Set(existingRows.map((r) => r.assetNumber));

  for (const row of rows) {
    try {
      const exists = existingSet.has(row.assetNumber);

      if (exists && mode === "skip") {
        skipped += 1;
        continue;
      }

      const data = {
        assetVisionId: row.assetVisionId,
        name: row.name,
        type: row.type,
        roadName: row.roadName || row.parentAssetName || "Unknown Road",
        location: row.location,
        latitude: row.latitude,
        longitude: row.longitude,
        parentDirection: row.parentDirection,
        parentChainage: row.parentChainage,
        chainageFrom: row.chainageFrom,
        chainageTo: row.chainageTo,
        parentAssetCode: row.parentAssetCode,
        parentAssetName: row.parentAssetName,
        classification: row.classification,
        subClassification: row.subClassification,
        notes: row.notes,
      };

      if (exists) {
        await prisma.asset.update({
          where: { assetNumber: row.assetNumber },
          data,
        });
        updated += 1;
      } else {
        await prisma.asset.create({
          data: { assetNumber: row.assetNumber, ...data },
        });
        existingSet.add(row.assetNumber);
        created += 1;
      }
    } catch (e) {
      rowErrors.push(
        `${row.assetNumber}: ${e instanceof Error ? e.message : "row failed"}`,
      );
    }
  }

  revalidatePath("/manage/assets");
  revalidatePath("/assets");
  revalidatePath("/");

  return {
    created,
    updated,
    skipped,
    errors: rowErrors,
    total: rows.length,
  };
}
