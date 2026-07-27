import fs from "node:fs";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import {
  jobZipPath,
  verifyClientExportDownload,
} from "@/lib/client-export-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Token-authenticated ZIP download (no session cookie required).
 * Intended for browser navigation / <a download> — Cloudflare often blocks
 * fetch() of large application/zip responses from authenticated API routes.
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
      { error: "Export not found or link expired" },
      { status: 404 },
    );
  }

  const zipPath = jobZipPath(job.id);
  if (!fs.existsSync(zipPath)) {
    return NextResponse.json(
      { error: "Export file missing — try again" },
      { status: 404 },
    );
  }

  const filename =
    (req.nextUrl.searchParams.get("name") || job.filename || "client-export.zip")
      .replace(/[/\\?%*:|"<>]/g, "_")
      .slice(0, 180);
  const stat = fs.statSync(zipPath);
  const stream = fs.createReadStream(zipPath);
  const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

  return new NextResponse(webStream, {
    headers: {
      // octet-stream + attachment is less likely to trip ZIP-specific WAF rules
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(stat.size),
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
