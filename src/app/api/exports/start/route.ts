import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canViewInspection } from "@/lib/inspection-access";
import {
  createClientExportJob,
  readClientExportJob,
  clientExportManifestUrl,
} from "@/lib/client-export-job";
import { startClientExportBuild } from "@/lib/client-export-build";
import { EXPORT_CHUNK_SIZE } from "@/lib/export-chunks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Start a client-export job. Prefer FormData (Cloudflare-friendly); JSON also OK.
 * Body fields: inspectionId, severities (comma or JSON), photoOrder (pipe or JSON).
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let inspectionId = "";
  let severities: string[] | null = null;
  let photoOrder: string[] | null = null;

  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
      const fd = await req.formData();
      inspectionId = String(fd.get("inspectionId") ?? "").trim();
      const sev = String(fd.get("severities") ?? "").trim();
      const ord = String(fd.get("photoOrder") ?? "").trim();
      if (sev) severities = sev.split(",").map((s) => s.trim()).filter(Boolean);
      if (ord) photoOrder = ord.split("|").map((s) => s.trim()).filter(Boolean);
    } else {
      const body = (await req.json()) as {
        inspectionId?: string;
        severities?: string[];
        photoOrder?: string[];
      };
      inspectionId = String(body.inspectionId ?? "").trim();
      if (Array.isArray(body.severities)) {
        severities = body.severities.map(String);
      }
      if (Array.isArray(body.photoOrder)) {
        photoOrder = body.photoOrder.map(String);
      }
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!inspectionId) {
    return NextResponse.json({ error: "inspectionId required" }, { status: 400 });
  }

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    select: { id: true, createdById: true, status: true },
  });
  if (!inspection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user.role !== "ADMIN" && !canViewInspection(user, inspection)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const job = createClientExportJob({
    inspectionId,
    userId: user.id,
  });

  const building = startClientExportBuild(job.id, { ...user }, inspectionId, {
    severities,
    photoOrder,
  });

  // Wait briefly so small packs can return ready+downloadUrl in one round-trip.
  // Large packs keep building in the background after this returns.
  await Promise.race([
    building,
    new Promise<void>((resolve) => setTimeout(resolve, 4000)),
  ]);

  const latest = readClientExportJob(job.id) ?? job;
  const manifestUrl =
    latest.status === "ready" && latest.token
      ? clientExportManifestUrl(latest)
      : null;

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
    sha256: latest.sha256 ?? null,
    manifestUrl,
    // Compat: older clients looked for downloadUrl — point them at the manifest
    downloadUrl: manifestUrl,
  });
}

/** Poll job status (session required). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const jobId = req.nextUrl.searchParams.get("job");
  const job = readClientExportJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Export job not found" }, { status: 404 });
  }
  if (job.userId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    sha256: job.sha256 ?? null,
    manifestUrl:
      job.status === "ready" && job.token
        ? clientExportManifestUrl(job)
        : null,
    downloadUrl:
      job.status === "ready" && job.token
        ? clientExportManifestUrl(job)
        : null,
  });
}
