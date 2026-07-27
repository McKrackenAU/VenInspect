import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { parseAssetWorkbook } from "@/lib/asset-import";
import { requireAdminFromRequest } from "@/lib/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST multipart: file=registry workbook, mode=upsert|skip
 * Prefer this over the server action — large Excel uploads are more reliable.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminFromRequest(req);
  if (auth.error) return auth.error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not read upload. File may be too large for the server — try CSV or a smaller workbook.",
      },
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

  // Soft guard — huge Asset Vision dumps should still work; warn via errors
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large (max 25 MB). Split the workbook or use CSV." },
      { status: 413 },
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
