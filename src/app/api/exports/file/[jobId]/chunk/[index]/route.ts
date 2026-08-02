import { NextRequest, NextResponse } from "next/server";
import {
  readExportChunk,
  verifyClientExportDownload,
} from "@/lib/client-export-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One ≤10 MiB chunk of a finished export ZIP.
 * Auth = job token (middleware-bypassed).
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string; index: string }> },
) {
  const { jobId, index: indexRaw } = await context.params;
  const token = req.nextUrl.searchParams.get("token");
  const index = Number.parseInt(indexRaw, 10);
  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "Invalid chunk index" }, { status: 400 });
  }

  const job = verifyClientExportDownload(jobId, token);
  if (!job) {
    return NextResponse.json(
      { error: "Export not found or link expired. Build the pack again." },
      { status: 404 },
    );
  }

  const chunk = readExportChunk(job, index);
  if (!chunk) {
    return NextResponse.json(
      { error: `Chunk ${index} not available` },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(chunk.data), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(chunk.data.length),
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "X-Chunk-Index": String(index),
      "X-Chunk-Offset": String(chunk.offset),
      "X-Chunk-Sha256": chunk.sha256,
    },
  });
}
