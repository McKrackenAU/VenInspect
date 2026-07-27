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

/**
 * POST multipart: file=registry workbook, mode=upsert|skip
 *
 * Auth (any one is enough):
 * 1. X-VenInspect-Import-Ticket / ?ticket= — minted by the Import page after
 *    requireAdmin() (survives multipart Cookie quirks)
 * 2. Session cookie on the request
 * 3. cookies() / getCurrentUser() fallback
 */
export async function POST(req: NextRequest) {
  const ticket =
    req.headers.get("x-veninspect-import-ticket") ||
    req.nextUrl.searchParams.get("ticket") ||
    "";

  const ticketUser = await verifyAssetImportTicket(ticket);
  let authed = Boolean(ticketUser);

  if (!authed) {
    const fromReq = await requireAdminFromRequest(req);
    if (fromReq.user) {
      authed = true;
    } else {
      const current = await getCurrentUser();
      if (current && isAdminRole(current.role, current.username)) {
        authed = true;
      }
    }
  }

  if (!authed) {
    return NextResponse.json(
      {
        error:
          "Admin access required. Refresh the Import page (so a new import ticket is issued), then try again. If it still fails, sign out and back in.",
      },
      { status: 403 },
    );
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

  const file = formData.get("file");
  const mode = String(formData.get("mode") ?? "upsert");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "Choose an Excel (.xlsx) or CSV file" },
      { status: 400 },
    );
  }

  if (file.size > 40 * 1024 * 1024) {
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
