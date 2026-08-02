import { NextRequest, NextResponse } from "next/server";
import {
  buildExportManifest,
  verifyClientExportDownload,
} from "@/lib/client-export-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Download manifest for chunked transfer (≤10 MiB chunks).
 * Auth = job token (middleware-bypassed).
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  const token = req.nextUrl.searchParams.get("token");
  const job = verifyClientExportDownload(jobId, token);
  if (!job) {
    return NextResponse.json(
      { error: "Export not found or link expired. Build the pack again." },
      { status: 404 },
    );
  }
  const manifest = buildExportManifest(job);
  if (!manifest) {
    return NextResponse.json(
      { error: "Export file missing on server — build the pack again." },
      { status: 404 },
    );
  }
  return NextResponse.json(manifest, {
    headers: {
      "Cache-Control": "no-store, private",
    },
  });
}
