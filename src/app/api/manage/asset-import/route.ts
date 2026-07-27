import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseAssetWorkbook } from "@/lib/asset-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST multipart: file=registry workbook, mode=upsert|skip
 * Prefer this over the server action — large Excel uploads are more reliable.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Could not read upload. Try a smaller file or CSV." },
      { status: 413 },
    );
  }

  const file = formData.get("file");
  const mode = String(formData.get("mode") ?? "upsert");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "Choose an Excel (.xlsx) or CSV file" },
      { status: 400 },
    );
  }

  let rows;
  let parseErrors: string[];
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    ({ rows, errors: parseErrors } = parseAssetWorkbook(buffer));
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? `Could not parse file: ${e.message}`
            : "Could not parse file",
      },
      { status: 400 },
    );
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [...parseErrors];

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
      errors.push(
        `${row.assetNumber}: ${e instanceof Error ? e.message : "row failed"}`,
      );
    }
  }

  revalidatePath("/manage/assets");
  revalidatePath("/assets");
  revalidatePath("/");

  return NextResponse.json({
    ok: true,
    created,
    updated,
    skipped,
    errors,
    total: rows.length,
  });
}
