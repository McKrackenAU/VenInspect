import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST multipart: file=DoT workbook (.xlsx)
 * Parses References + Structure Information-ish sheets for dropdown context.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fd = await req.formData();
  const file = fd.get("file");
  const assetId = String(fd.get("assetId") ?? "");
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "Choose an .xlsx file" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetNames = wb.SheetNames;

  const references = wb.Sheets["References"]
    ? XLSX.utils.sheet_to_json(wb.Sheets["References"], { defval: "" })
    : [];

  const defectSheet = wb.Sheets["Structure Defect & Treatment"]
    ? XLSX.utils.sheet_to_json(wb.Sheets["Structure Defect & Treatment"], {
        header: 1,
        defval: "",
      })
    : [];

  const conditionSheet = wb.Sheets["Condition Rating"]
    ? XLSX.utils.sheet_to_json(wb.Sheets["Condition Rating"], {
        header: 1,
        defval: "",
      })
    : [];

  let assetUpdated = false;
  if (assetId) {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (asset) {
      const notes = [
        asset.notes ?? "",
        `\n--- Imported DoT workbook context (${file.name}) ---`,
        `Sheets: ${sheetNames.join(", ")}`,
        `References rows: ${Array.isArray(references) ? references.length : 0}`,
      ]
        .filter(Boolean)
        .join("\n");
      await prisma.asset.update({
        where: { id: assetId },
        data: { notes },
      });
      assetUpdated = true;
    }
  }

  return NextResponse.json({
    ok: true,
    sheetNames,
    referencesCount: Array.isArray(references) ? references.length : 0,
    defectRows: Array.isArray(defectSheet) ? defectSheet.length : 0,
    conditionRows: Array.isArray(conditionSheet) ? conditionSheet.length : 0,
    sampleReferences: Array.isArray(references) ? references.slice(0, 5) : [],
    assetUpdated,
  });
}
