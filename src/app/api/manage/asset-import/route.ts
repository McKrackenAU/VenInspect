import { NextRequest, NextResponse } from "next/server";
import { runAssetImport } from "@/lib/asset-import-run";
import { requireAdminFromRequest } from "@/lib/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST multipart: file=registry workbook, mode=upsert|skip
 * Used by the Import assets UI (multipart is more reliable than a server action).
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

  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large (max 25 MB). Split the workbook or use CSV." },
      { status: 413 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await runAssetImport(buffer, mode);
    return NextResponse.json({ ok: true, ...result });
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
}
