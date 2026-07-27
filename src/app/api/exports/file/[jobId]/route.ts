import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import {
  jobZipPath,
  verifyClientExportDownload,
} from "@/lib/client-export-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contentDisposition(filename: string) {
  const ascii = filename
    .replace(/[^\x20-\x7E]+/g, "_")
    .replace(/["\\]/g, "_")
    .slice(0, 150) || "client-export.zip";
  const encoded = encodeURIComponent(filename).replace(/['()]/g, escape);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/**
 * Token-authenticated ZIP download (no session cookie required).
 * Returns the full buffer (not a stream) — Chrome reports
 * "file wasn't available on site" when streamed downloads abort.
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

  const zipPath = jobZipPath(job.id);
  let data: Buffer;
  try {
    data = fs.readFileSync(zipPath);
  } catch {
    return NextResponse.json(
      { error: "Export file missing on server — build the pack again." },
      { status: 404 },
    );
  }
  if (!data.length) {
    return NextResponse.json(
      { error: "Export file was empty — build the pack again." },
      { status: 404 },
    );
  }

  const filename =
    (req.nextUrl.searchParams.get("name") ||
      job.filename ||
      "client-export.zip")
      .replace(/[/\\?%*:|"<>]/g, "_")
      .slice(0, 180) || "client-export.zip";

  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": contentDisposition(filename),
      "Content-Length": String(data.length),
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
