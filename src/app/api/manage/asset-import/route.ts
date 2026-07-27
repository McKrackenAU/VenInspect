import { NextRequest, NextResponse } from "next/server";
import { runAssetImport } from "@/lib/asset-import-run";
import { getCurrentUser } from "@/lib/auth";
import { verifyAssetImportGrant } from "@/lib/import-grant";
import { verifyAssetImportTicket } from "@/lib/import-ticket";
import { requireAdminFromRequest } from "@/lib/request-auth";
import { isAdminRole } from "@/lib/roles";

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

function readTicket(req: NextRequest, formTicket?: string | null): string {
  return (
    req.headers.get("x-veninspect-import-ticket") ||
    req.nextUrl.searchParams.get("ticket") ||
    (formTicket ?? "") ||
    ""
  );
}

async function assertAdmin(
  req: NextRequest,
  opts: { grant: string; ticket: string },
): Promise<
  | { ok: true }
  | {
      ok: false;
      status: number;
      error: string;
      debug: Record<string, unknown>;
    }
> {
  const grantUser = verifyAssetImportGrant(opts.grant);
  if (grantUser) return { ok: true };

  const ticketUser = await verifyAssetImportTicket(opts.ticket);
  if (ticketUser) return { ok: true };

  const fromReq = await requireAdminFromRequest(req);
  if (fromReq.user) return { ok: true };

  const current = await getCurrentUser();
  if (current && isAdminRole(current.role, current.username)) return { ok: true };

  let nested: { error?: string; debug?: Record<string, unknown> } | null = null;
  if (fromReq.error) {
    try {
      nested = (await fromReq.error.clone().json()) as {
        error?: string;
        debug?: Record<string, unknown>;
      };
    } catch {
      nested = null;
    }
  }

  const status = fromReq.error?.status ?? 403;
  return {
    ok: false,
    status: status === 401 ? 401 : 403,
    error:
      nested?.error ||
      (status === 401
        ? "Not signed in. Open Import again while signed in as Admin, then retry."
        : "Admin access required. Open Import again (creates a fresh grant), then retry. If it continues, confirm Role=Admin under Manage → Users."),
    debug: {
      hasGrant: Boolean(opts.grant),
      grantOk: false,
      hasTicket: Boolean(opts.ticket),
      ticketOk: false,
      sessionCookie: Boolean(
        req.cookies.get("vi_session")?.value ||
          req.headers.get("cookie")?.includes("vi_session="),
      ),
      ...(nested?.debug ?? {}),
    },
  };
}

async function runImport(buffer: Buffer, mode: string) {
  const result = await runAssetImport(buffer, mode);
  return NextResponse.json({ ok: true, ...result });
}

/**
 * POST asset registry import.
 *
 * Auth (any one):
 *  1. Short grant id (?grant=) minted by the Import page after requireAdmin
 *  2. Legacy HMAC ticket
 *  3. Session cookie / getCurrentUser admin
 */
export async function POST(req: NextRequest) {
  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  const isMultipart = contentType.includes("multipart/form-data");

  if (!isMultipart) {
    const auth = await assertAdmin(req, {
      grant: readGrantId(req),
      ticket: readTicket(req),
    });
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error, debug: auth.debug },
        { status: auth.status },
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
      return await runImport(buffer, mode);
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

  const auth = await assertAdmin(req, {
    grant: readGrantId(req, String(formData.get("importGrant") ?? "")),
    ticket: readTicket(req, String(formData.get("importTicket") ?? "")),
  });
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, debug: auth.debug },
      { status: auth.status },
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
    return await runImport(buffer, mode);
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
