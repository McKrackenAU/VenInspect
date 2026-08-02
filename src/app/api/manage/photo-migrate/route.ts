import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPhotoDir } from "@/lib/paths";
import {
  listRememberedPhotoDirs,
  migratePhotosToActiveRoot,
  rememberPreviousPhotoDir,
  type PhotoMigrateMode,
} from "@/lib/photo-migrate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — active root + remembered previous roots */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({
    ok: true,
    activePhotoDir: getPhotoDir(),
    previousPhotoDirs: listRememberedPhotoDirs(),
  });
}

/**
 * POST JSON:
 * { from, mode?: "copy"|"move", dryRun?: boolean, rememberOnly?: boolean }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    from?: string;
    mode?: PhotoMigrateMode;
    dryRun?: boolean;
    rememberOnly?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const from = String(body.from ?? "").trim();
  if (!from) {
    return NextResponse.json(
      { error: "Provide the old photo folder path in `from`" },
      { status: 400 },
    );
  }

  try {
    if (body.rememberOnly) {
      rememberPreviousPhotoDir(from);
      return NextResponse.json({
        ok: true,
        remembered: true,
        from,
        activePhotoDir: getPhotoDir(),
        previousPhotoDirs: listRememberedPhotoDirs(),
        message:
          "Old folder registered as a read fallback. Photos should appear again; still run Copy to move them onto the bind mount.",
      });
    }

    const result = migratePhotosToActiveRoot({
      from,
      mode: body.mode === "move" ? "move" : "copy",
      dryRun: Boolean(body.dryRun),
      rememberSource: true,
    });
    return NextResponse.json({
      ...result,
      activePhotoDir: getPhotoDir(),
      previousPhotoDirs: listRememberedPhotoDirs(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Migrate failed" },
      { status: 400 },
    );
  }
}
