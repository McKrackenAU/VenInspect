import { NextRequest, NextResponse } from "next/server";
import { runAssetImport } from "@/lib/asset-import-run";
import { getCurrentUser } from "@/lib/auth";
import { verifyAssetImportTicket } from "@/lib/import-ticket";
import { requireAdminFromRequest } from "@/lib/request-auth";
import { isAdminRole } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Allow bulk registry imports (hundreds of rows) without cutting off early. */
export const maxDuration = 300;

const MAX_BYTES = 40 * 1024 * 1024;

function ticketFromRequest(req: NextRequest, formTicket?: string | null): string {
  return (
    req.headers.get("x-veninspect-import-ticket") ||
    req.nextUrl.searchParams.get("ticket") ||
    (formTicket ?? "") ||
    ""
  );
}

async function assertAdmin(req: NextRequest, ticket: string): Promise<boolean> {
  if (await verifyAssetImportTicket(ticket)) return true;

  const fromReq = await requireAdminFromRequest(req);
  if (fromReq.user) return true;

  const current = await getCurrentUser();
  return Boolean(current && isAdminRole(current.role, current.username));
}

/**
 * POST asset registry import.
 *
 * Preferred body: raw bytes (application/octet-stream) with
 *   ?mode=&filename=&ticket= and header X-VenInspect-Import-Ticket
 * Fallback: multipart form (file, mode, importTicket)
 *
 * Auth (any one): import ticket (page-minted) | request cookie | cookies() admin
 */
export async function POST(req: NextRequest) {
  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  const isMultipart = contentType.includes("multipart/form-data");

  // --- Raw body (avoids multipart Cookie quirks) ---
  if (!isMultipart) {
    const ticket = ticketFromRequest(req);
    if (!(await assertAdmin(req, ticket))) {
      return NextResponse.json(
        {
          error:
            "Admin access required. Update to the latest build, hard-refresh Import, then retry. If it continues, sign out and back in.",
        },
        { status: 403 },
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

  // --- Multipart fallback ---
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

  const ticket = ticketFromRequest(
    req,
    String(formData.get("importTicket") ?? ""),
  );

  if (!(await assertAdmin(req, ticket))) {
    return NextResponse.json(
      {
        error:
          "Admin access required. Update to the latest build, hard-refresh Import, then retry. If it continues, sign out and back in.",
      },
      { status: 403 },
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
