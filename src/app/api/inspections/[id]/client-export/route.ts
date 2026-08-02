import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canViewInspection } from "@/lib/inspection-access";
import {
  createClientExportJob,
  jobZipPath,
  readClientExportJob,
  clientExportManifestUrl,
  clientExportFileUrl,
} from "@/lib/client-export-job";
import { startClientExportBuild } from "@/lib/client-export-build";
import { EXPORT_CHUNK_SIZE } from "@/lib/export-chunks";
import fs from "node:fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Start a background export job — returns small JSON (Cloudflare-friendly). */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { id } = await context.params;
  const inspection = await prisma.inspection.findUnique({
    where: { id },
    select: { id: true, createdById: true, status: true },
  });
  if (!inspection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user.role !== "ADMIN" && !canViewInspection(user, inspection)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { severities?: string[]; photoOrder?: string[] } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const job = createClientExportJob({
    inspectionId: id,
    userId: user.id,
  });
  const building = startClientExportBuild(job.id, { ...user }, id, {
    severities: Array.isArray(body.severities)
      ? body.severities.map(String)
      : null,
    photoOrder: Array.isArray(body.photoOrder)
      ? body.photoOrder.map(String)
      : null,
  });
  await Promise.race([
    building,
    new Promise<void>((resolve) => setTimeout(resolve, 4000)),
  ]);
  const latest = readClientExportJob(job.id) ?? job;

  return NextResponse.json({
    ok: true,
    jobId: latest.id,
    token: latest.token,
    status: latest.status,
    filename: latest.filename,
    error: latest.error,
    ready: latest.status === "ready",
    chunkSize: EXPORT_CHUNK_SIZE,
    size: latest.size ?? null,
    chunkCount: latest.chunkCount ?? null,
    manifestUrl:
      latest.status === "ready" && latest.token
        ? clientExportManifestUrl(latest)
        : null,
    downloadUrl:
      latest.status === "ready" && latest.token
        ? clientExportFileUrl(latest)
        : null,
  });
}

/**
 * Job status (`?job=`) or legacy ZIP download (`?job=&download=1`).
 * Prefer token URL from status JSON + browser navigation for Cloudflare.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { id } = await context.params;
  const jobId = req.nextUrl.searchParams.get("job");
  const wantDownload = req.nextUrl.searchParams.get("download") === "1";

  if (jobId) {
    const job = readClientExportJob(jobId);
    if (!job || job.inspectionId !== id) {
      return NextResponse.json(
        { error: "Export job not found" },
        { status: 404 },
      );
    }
    if (job.userId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (wantDownload) {
      if (job.status !== "ready") {
        return NextResponse.json(
          {
            status: job.status,
            error: job.error,
            ready: false,
          },
          { status: job.status === "error" ? 500 : 202 },
        );
      }
      // Redirect to token download — avoids large ZIP through this authenticated route
      if (job.token) {
        return NextResponse.redirect(
          new URL(clientExportFileUrl(job), req.url),
          303,
        );
      }
      try {
        const data = await fs.readFile(jobZipPath(job.id));
        const filename = job.filename || "client-export.zip";
        return new NextResponse(new Uint8Array(data), {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
            "Content-Length": String(data.length),
          },
        });
      } catch {
        return NextResponse.json(
          { error: "Export file missing — try again" },
          { status: 404 },
        );
      }
    }
    return NextResponse.json({
      ok: true,
      jobId: job.id,
      token: job.token,
      status: job.status,
      filename: job.filename,
      error: job.error,
      ready: job.status === "ready",
      chunkSize: EXPORT_CHUNK_SIZE,
      size: job.size ?? null,
      chunkCount: job.chunkCount ?? null,
      manifestUrl:
        job.status === "ready" && job.token
          ? clientExportManifestUrl(job)
          : null,
      downloadUrl:
        job.status === "ready" && job.token
          ? clientExportFileUrl(job)
          : null,
    });
  }

  // Legacy: kick off a default job
  const inspection = await prisma.inspection.findUnique({
    where: { id },
    select: { id: true, createdById: true, status: true },
  });
  if (!inspection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user.role !== "ADMIN" && !canViewInspection(user, inspection)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const job = createClientExportJob({ inspectionId: id, userId: user.id });
  startClientExportBuild(job.id, { ...user }, id, {});
  return NextResponse.json(
    {
      ok: true,
      jobId: job.id,
      token: job.token,
      status: "pending" as const,
      message: "Export started — poll ?job= then open downloadUrl",
    },
    { status: 202 },
  );
}
