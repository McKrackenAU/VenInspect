import { NextRequest, NextResponse } from "next/server";
import { runAssetImport } from "@/lib/asset-import-run";
import { getCurrentUser } from "@/lib/auth";
import { requireAdminFromRequest } from "@/lib/request-auth";
import { isAdminRole } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Allow bulk registry imports (hundreds of rows) without cutting off early. */
export const maxDuration = 300;

/**
 * POST multipart: file=registry workbook, mode=upsert|skip
 * Preferred path for bulk asset import (avoids server-action flight failures).
 */
export async function POST(req: NextRequest) {
  // Prefer request cookies (multipart-safe), then fall back to cookies()/DB user.
  const fromReq = await requireAdminFromRequest(req);
  let adminUser = fromReq.user ?? null;

  if (!adminUser) {
    const current = await getCurrentUser();
    if (current && isAdminRole(current.role, current.username)) {
      adminUser = current;
    }
  }

  if (!adminUser) {
    const status = fromReq.error?.status ?? 403;
    const payload = fromReq.error
      ? await fromReq.error
          .clone()
          .json()
          .catch(() => ({ error: "Admin access required." }))
      : {
          error:
            "Admin access required. Open Manage → Users, confirm Role=Admin, sign out and back in, then retry.",
        };
    return NextResponse.json(payload, { status });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not read the upload body. If this keeps happening, export as CSV and retry.",
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

  // ~200 assets is tiny; keep a generous ceiling for Asset Vision dumps.
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
