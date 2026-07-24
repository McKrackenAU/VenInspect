import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canEditInspection } from "@/lib/inspection-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await context.params;
  const inspection = await prisma.inspection.findUnique({ where: { id } });
  if (!inspection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditInspection(user, inspection)) {
    return NextResponse.json({ error: "Cannot edit" }, { status: 403 });
  }

  let body: {
    overlayId?: string;
    pins?: unknown;
    imagePath?: string;
    label?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pinsJson = JSON.stringify(body.pins ?? []);
  if (body.overlayId) {
    const row = await prisma.defectMappingOverlay.update({
      where: { id: body.overlayId },
      data: {
        pinsJson,
        ...(body.imagePath ? { imagePath: body.imagePath } : {}),
        ...(body.label != null ? { label: body.label } : {}),
      },
    });
    return NextResponse.json({ ok: true, overlay: row });
  }

  if (!body.imagePath) {
    return NextResponse.json({ error: "imagePath required" }, { status: 400 });
  }

  const row = await prisma.defectMappingOverlay.create({
    data: {
      inspectionId: id,
      imagePath: body.imagePath,
      pinsJson,
      label: body.label ?? "Defect mapping",
    },
  });
  return NextResponse.json({ ok: true, overlay: row });
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await context.params;
  const overlays = await prisma.defectMappingOverlay.findMany({
    where: { inspectionId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ overlays });
}
