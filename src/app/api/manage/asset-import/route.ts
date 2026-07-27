import { NextRequest, NextResponse } from "next/server";
import { runAssetImport } from "@/lib/asset-import-run";
import { verifyAssetImportGrant } from "@/lib/import-grant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Allow bulk registry imports (hundreds of rows) without cutting off early. */
export const maxDuration = 300;

const MAX_BYTES = 40 * 1024 * 1024;

function readGrantId(req: NextRequest, formGrant?: string | null): string {
  return (
    req.nextUrl.searchParams.get("grant") ||
    req.headers.get("x-veninspect-import-grant") ||
    (formGrant ?? "") ||
    ""
  );
}

/**
 * POST asset registry import.
 * Manage UI already requires admin. Auth here is only the short grant minted
 * on the Import page — no role re-check.
 */
export async function POST(req: NextRequest) {
  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  const isMultipart = contentType.includes("multipart/form-data");

  if (!isMultipart) {
    if (!verifyAssetImportGrant(readGrantId(req))) {
      return NextResponse.json(
        {
          error:
            "Import session expired. Open Manage → Assets → Import again, then retry.",
        },
        { status: 401 },
      );
    }

    const mode = req.nextUrl.searchParams.get("mode") || "upsert";
    let buffer: Buffer;
    try {
      buffer = Buffer.from(await req.arrayBuffer());
    } catch {
      return NextResponse.json(
        { error: "Could not read the upload body." },
        { status: 413 },
      );
    }

    if (buffer.length === 0) {
      return NextResponse.json(
        { error: "Choose an Excel (.xlsx) or CSV file" },
        { status: 400 },
      );
    }
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 40 MB)." },
        { status: 413 },
      );
    }

    try {
      const result = await runAssetImport(buffer, mode);
      return NextResponse.json({ ok: true, ...result });
    } catch (e) {
      return NextResponse.json(
        {
          error:
            e instanceof Error
              ? `Could not import file: ${e.message}`
              : "Could not import file",
        },
        { status: 400 },
      );
    }
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not read the upload body. Export as CSV and retry if this continues.",
      },
      { status: 413 },
    );
  }

  const grant = readGrantId(req, String(formData.get("importGrant") ?? ""));
  if (!verifyAssetImportGrant(grant)) {
    return NextResponse.json(
      {
        error:
          "Import session expired. Open Manage → Assets → Import again, then retry.",
      },
      { status: 401 },
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
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 40 MB)." },
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
            ? `Could not import file: ${e.message}`
            : "Could not import file",
      },
      { status: 400 },
    );
  }
}
