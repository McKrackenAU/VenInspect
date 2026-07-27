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

/** Shared upsert loop for server action + API route. */
export async function runAssetImport(
  buffer: Buffer,
  mode: string,
): Promise<AssetImportResult> {
  const { rows, errors } = parseAssetWorkbook(buffer);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const rowErrors = [...errors];

  for (const row of rows) {
    try {
      const existing = await prisma.asset.findUnique({
        where: { assetNumber: row.assetNumber },
      });

      if (existing && mode === "skip") {
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

      if (existing) {
        await prisma.asset.update({
          where: { assetNumber: row.assetNumber },
          data,
        });
        updated += 1;
      } else {
        await prisma.asset.create({
          data: { assetNumber: row.assetNumber, ...data },
        });
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
