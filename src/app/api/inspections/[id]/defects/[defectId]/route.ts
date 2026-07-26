import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canEditInspection } from "@/lib/inspection-access";
import {
  addPhotosToDefect,
  breakoutDefectPhotos,
  renumberDefects,
  MAX_DEFECT_PHOTOS,
} from "@/lib/defect-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST multipart: add photos to defect (photo files + optional captions JSON) */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; defectId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id: inspectionId, defectId } = await context.params;

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { asset: true },
  });
  if (!inspection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditInspection(user, inspection)) {
    return NextResponse.json({ error: "Cannot edit" }, { status: 403 });
  }

  const defect = await prisma.defect.findFirst({
    where: { id: defectId, inspectionId },
  });
  if (!defect) return NextResponse.json({ error: "Defect not found" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Upload too large" }, { status: 413 });
  }

  const captionsRaw = String(formData.get("captions") ?? "[]");
  let captions: string[] = [];
  try {
    captions = JSON.parse(captionsRaw) as string[];
  } catch {
    captions = [];
  }

  const files: {
    buffer: Buffer;
    originalName: string;
    caption?: string;
    fileLastModifiedMs?: number | null;
  }[] = [];
  for (const [key, val] of formData.entries()) {
    if (!key.startsWith("photo") || !(val instanceof Blob) || val.size === 0) continue;
    files.push({
      buffer: Buffer.from(await val.arrayBuffer()),
      originalName: val instanceof File ? val.name : "photo.jpg",
      caption: captions[files.length],
      fileLastModifiedMs:
        val instanceof File && Number.isFinite(val.lastModified)
          ? val.lastModified
          : null,
    });
  }
  if (!files.length) {
    return NextResponse.json({ error: "No photos" }, { status: 400 });
  }

  try {
    const created = await addPhotosToDefect({
      defectId,
      inspection,
      defectCode: defect.defectCode,
      files,
    });
    await prisma.inspection.update({
      where: { id: inspectionId },
      data: { lastEditedAt: new Date() },
    });
    revalidatePath(`/inspections/${inspectionId}`);
    return NextResponse.json({
      ok: true,
      photos: created,
      max: MAX_DEFECT_PHOTOS,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 400 },
    );
  }
}

/** PATCH: update captions, reorder defects, or breakout */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; defectId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id: inspectionId, defectId } = await context.params;

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { asset: true },
  });
  if (!inspection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditInspection(user, inspection)) {
    return NextResponse.json({ error: "Cannot edit" }, { status: 403 });
  }

  let body: {
    action?: string;
    captions?: { id: string; caption: string }[];
    photoIds?: string[];
    orderedDefectIds?: string[];
    fields?: Record<string, unknown>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "renumber" && Array.isArray(body.orderedDefectIds)) {
    for (let i = 0; i < body.orderedDefectIds.length; i++) {
      await prisma.defect.updateMany({
        where: { id: body.orderedDefectIds[i], inspectionId },
        data: { sortOrder: i },
      });
    }
    await renumberDefects(inspectionId, inspection.asset.assetNumber);
    revalidatePath(`/inspections/${inspectionId}`);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "breakout" && Array.isArray(body.photoIds)) {
    try {
      const ids = await breakoutDefectPhotos({
        defectId,
        photoIds: body.photoIds,
        inspectionId,
        assetNumber: inspection.asset.assetNumber,
      });
      revalidatePath(`/inspections/${inspectionId}`);
      return NextResponse.json({ ok: true, createdIds: ids });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Breakout failed" },
        { status: 400 },
      );
    }
  }

  if (Array.isArray(body.captions)) {
    for (const c of body.captions) {
      await prisma.defectPhoto.updateMany({
        where: { id: c.id, defectId },
        data: { caption: c.caption },
      });
    }
  }

  if (body.fields && typeof body.fields === "object") {
    const f = body.fields;
    await prisma.defect.update({
      where: { id: defectId },
      data: {
        ...(typeof f.taskTypeId === "string" || f.taskTypeId === null
          ? { taskTypeId: f.taskTypeId as string | null }
          : {}),
        ...(typeof f.groupName === "string" ? { groupName: f.groupName } : {}),
        ...(typeof f.groupNumber === "string" ? { groupNumber: f.groupNumber } : {}),
        ...(typeof f.componentNumber === "string"
          ? { componentNumber: f.componentNumber }
          : {}),
        ...(typeof f.locationDetail === "string"
          ? { locationDetail: f.locationDetail }
          : {}),
        ...(typeof f.defectUnit === "string" ? { defectUnit: f.defectUnit } : {}),
        ...(typeof f.treatmentType === "string"
          ? { treatmentType: f.treatmentType }
          : {}),
        ...(typeof f.treatmentTimeframe === "string"
          ? { treatmentTimeframe: f.treatmentTimeframe }
          : {}),
        ...(typeof f.defectQty === "number" || f.defectQty === null
          ? { defectQty: f.defectQty as number | null }
          : {}),
        ...(typeof f.description === "string" ? { description: f.description } : {}),
        ...(typeof f.comments === "string" ? { comments: f.comments } : {}),
        ...(typeof f.severity === "string" ? { severity: f.severity } : {}),
      },
    });
  }

  await prisma.inspection.update({
    where: { id: inspectionId },
    data: { lastEditedAt: new Date() },
  });
  revalidatePath(`/inspections/${inspectionId}`);
  return NextResponse.json({ ok: true });
}
