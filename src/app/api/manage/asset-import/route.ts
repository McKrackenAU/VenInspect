import { NextRequest, NextResponse } from "next/server";
import { runAssetImport } from "@/lib/asset-import-run";
import { verifyAssetImportGrant } from "@/lib/import-grant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 40 * 1024 * 1024;

function grantDenied() {
  return NextResponse.json(
    {
      error:
        "Import session expired. Open Manage → Assets → Import again, then retry.",
    },
    { status: 401 },
  );
}

function readGrant(
  req: NextRequest,
  extra?: string | null,
): string {
  return (
    (extra ?? "") ||
    req.nextUrl.searchParams.get("grant") ||
    req.headers.get("x-veninspect-import-grant") ||
    req.cookies.get("vi_import_grant")?.value ||
    ""
  );
}

async function finish(buffer: Buffer, mode: string) {
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

/**
 * POST asset registry import.
 * Manage UI already requires admin — only the page-minted grant is checked.
 *
 * Accepted bodies:
 *  1. multipart/form-data — fields: file, importGrant, mode
 *  2. application/json — { grant, mode, filename?, contentBase64 }
 *  3. raw bytes + ?grant= (legacy)
 */
export async function POST(req: NextRequest) {
  const contentType = (req.headers.get("content-type") || "").toLowerCase();

  // --- JSON (Cloudflare-friendly; good for CSV / smaller workbooks) ---
  if (contentType.includes("application/json")) {
    let body: {
      grant?: string;
      mode?: string;
      contentBase64?: string;
      content?: string;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 },
      );
    }
    if (!verifyAssetImportGrant(readGrant(req, body.grant))) {
      return grantDenied();
    }
    const mode = body.mode || "upsert";
    let buffer: Buffer;
    if (body.contentBase64) {
      buffer = Buffer.from(body.contentBase64, "base64");
    } else if (typeof body.content === "string") {
      buffer = Buffer.from(body.content, "utf8");
    } else {
      return NextResponse.json(
        { error: "Missing contentBase64 (or content) in JSON body." },
        { status: 400 },
      );
    }
    return finish(buffer, mode);
  }

  // --- Multipart (standard file upload) ---
  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        {
          error:
            "Could not read the upload. If this keeps happening behind Cloudflare, export as CSV and retry.",
        },
        { status: 413 },
      );
    }
    if (
      !verifyAssetImportGrant(
        readGrant(req, String(formData.get("importGrant") ?? "")),
      )
    ) {
      return grantDenied();
    }
    const file = formData.get("file");
    const mode = String(formData.get("mode") ?? "upsert");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Choose an Excel (.xlsx) or CSV file" },
        { status: 400 },
      );
    }
    return finish(Buffer.from(await file.arrayBuffer()), mode);
  }

  // --- Raw body legacy ---
  if (!verifyAssetImportGrant(readGrant(req))) {
    return grantDenied();
  }
  const mode = req.nextUrl.searchParams.get("mode") || "upsert";
  try {
    return finish(Buffer.from(await req.arrayBuffer()), mode);
  } catch {
    return NextResponse.json(
      { error: "Could not read the upload body." },
      { status: 413 },
    );
  }
}
