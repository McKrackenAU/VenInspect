import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import fs from "node:fs/promises";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canEditInspection } from "@/lib/inspection-access";
import { nextDefectCode } from "@/lib/inspection";
import {
  parseFormPayload,
  serializeFormPayload,
  mediaKey,
  type FormMediaItem,
  type FormPayload,
} from "@/lib/inspection-template-types";
import {
  saveCompressedInspectionPhoto,
  saveCompressedDefectPhoto,
} from "@/lib/photos";
import { resolveExistingPhotoPath } from "@/lib/photo-resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function newMediaId() {
  return `fm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** POST multipart: photo upload for a form section/field, or raise defect from existing media */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id: inspectionId } = await context.params;
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Could not read upload. Try a smaller photo." },
      { status: 413 },
    );
  }

  const sectionId = String(formData.get("sectionId") ?? "").trim();
  const fieldId = String(formData.get("fieldId") ?? "").trim() || null;
  const caption = String(formData.get("caption") ?? "").trim() || undefined;
  const raiseDefect = String(formData.get("raiseDefect") ?? "") === "1";
  const existingMediaId = String(formData.get("mediaId") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;
  const subcategory = String(formData.get("subcategory") ?? "").trim() || null;
  const severity =
    String(formData.get("severity") ?? "CS3").trim() || "CS3";
  const photo = formData.get("photo");

  if (!sectionId) {
    return NextResponse.json({ error: "sectionId required" }, { status: 400 });
  }

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { asset: true, defects: true },
  });
  if (!inspection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canEditInspection(user, inspection)) {
    return NextResponse.json({ error: "Cannot edit" }, { status: 403 });
  }

  const key = mediaKey(sectionId, fieldId);
  const payload = parseFormPayload(inspection.formPayload);

  // Raise defect from an already-saved form photo (after "Save photo")
  if (raiseDefect && existingMediaId) {
    if (!description) {
      return NextResponse.json(
        { error: "Description required to raise a defect" },
        { status: 400 },
      );
    }
    const list = [...(payload.media?.[key] ?? [])];
    const idx = list.findIndex((m) => m.id === existingMediaId);
    if (idx < 0) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }
    const existing = list[idx]!;
    if (existing.defectId) {
      return NextResponse.json(
        { error: "This photo is already linked to a defect" },
        { status: 400 },
      );
    }

    const defectCode = nextDefectCode(
      inspection.asset.assetNumber,
      inspection.defects.map((d) => d.defectCode),
    );
    const takenAt = existing.takenAt ? new Date(existing.takenAt) : new Date();
    const defect = await prisma.defect.create({
      data: {
        inspectionId,
        defectCode,
        description,
        category: category ?? "Identification",
        subcategory: subcategory ?? "ID plate",
        severity,
        photoPath: existing.path,
        photos: {
          create: {
            path: existing.path,
            kind: "overview",
            sortOrder: 0,
            takenAt: Number.isNaN(takenAt.getTime()) ? new Date() : takenAt,
          },
        },
      },
    });

    list[idx] = { ...existing, defectId: defect.id };
    const media: FormPayload["media"] = { ...(payload.media ?? {}) };
    media[key] = list;
    const next: FormPayload = { ...payload, media };
    await prisma.inspection.update({
      where: { id: inspectionId },
      data: { formPayload: serializeFormPayload(next) },
    });

    revalidatePath(`/inspections/${inspectionId}`);
    revalidatePath(`/inspections/${inspectionId}/report`);
    return NextResponse.json({ ok: true, item: list[idx], media: next.media });
  }

  const blob = photo instanceof Blob && photo.size > 0 ? photo : null;
  if (!blob) {
    return NextResponse.json({ error: "Photo required" }, { status: 400 });
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const originalName =
    photo instanceof File ? photo.name : String(formData.get("photoName") ?? "");
  const mediaId = newMediaId();
  const stem = `form/${sectionId}${fieldId ? `/${fieldId}` : ""}/${mediaId}`;

  let relativePath: string;
  let defectId: string | undefined;
  let takenAt: Date;

  try {
    if (raiseDefect) {
      if (!description) {
        return NextResponse.json(
          { error: "Description required to raise a defect" },
          { status: 400 },
        );
      }
      const defectCode = nextDefectCode(
        inspection.asset.assetNumber,
        inspection.defects.map((d) => d.defectCode),
      );
      const saved = await saveCompressedDefectPhoto({
        buffer,
        roadName: inspection.asset.roadName || "Unknown Road",
        assetNumber: inspection.asset.assetNumber,
        folderKey: inspection.folderKey,
        defectCode,
        originalName,
        fileLastModifiedMs:
          photo instanceof File && Number.isFinite(photo.lastModified)
            ? photo.lastModified
            : null,
      });
      relativePath = saved.relativePath;
      takenAt = saved.takenAt;
      const defect = await prisma.defect.create({
        data: {
          inspectionId,
          defectCode,
          description,
          category: category ?? "Identification",
          subcategory: subcategory ?? "ID plate",
          severity,
          photoPath: relativePath,
          photos: {
            create: {
              path: relativePath,
              kind: "overview",
              sortOrder: 0,
              takenAt,
            },
          },
        },
      });
      defectId = defect.id;
    } else {
      const saved = await saveCompressedInspectionPhoto({
        buffer,
        roadName: inspection.asset.roadName || "Unknown Road",
        assetNumber: inspection.asset.assetNumber,
        folderKey: inspection.folderKey,
        relativeStem: stem,
        originalName,
        fileLastModifiedMs:
          photo instanceof File && Number.isFinite(photo.lastModified)
            ? photo.lastModified
            : null,
      });
      relativePath = saved.relativePath;
      takenAt = saved.takenAt;
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Photo save failed" },
      { status: 400 },
    );
  }

  const item: FormMediaItem = {
    id: mediaId,
    path: relativePath,
    caption,
    fieldId: fieldId ?? undefined,
    defectId,
    takenAt: takenAt.toISOString(),
  };
  const media: FormPayload["media"] = { ...(payload.media ?? {}) };
  media[key] = [...(media[key] ?? []), item];

  const next: FormPayload = { ...payload, media };
  await prisma.inspection.update({
    where: { id: inspectionId },
    data: { formPayload: serializeFormPayload(next) },
  });

  revalidatePath(`/inspections/${inspectionId}`);
  revalidatePath(`/inspections/${inspectionId}/report`);

  return NextResponse.json({ ok: true, item, media: next.media });
}

/** DELETE: remove a form media item by id */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id: inspectionId } = await context.params;
  let body: { mediaId?: string; sectionId?: string; fieldId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mediaId = String(body.mediaId ?? "").trim();
  const sectionId = String(body.sectionId ?? "").trim();
  const fieldId = body.fieldId ? String(body.fieldId).trim() : null;
  if (!mediaId || !sectionId) {
    return NextResponse.json(
      { error: "mediaId and sectionId required" },
      { status: 400 },
    );
  }

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
  });
  if (!inspection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canEditInspection(user, inspection)) {
    return NextResponse.json({ error: "Cannot edit" }, { status: 403 });
  }

  const payload = parseFormPayload(inspection.formPayload);
  const key = mediaKey(sectionId, fieldId);
  const list = [...(payload.media?.[key] ?? [])];
  const idx = list.findIndex((m) => m.id === mediaId);
  if (idx < 0) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
  const [removed] = list.splice(idx, 1);
  const media = { ...(payload.media ?? {}) };
  if (list.length) media[key] = list;
  else delete media[key];

  await prisma.inspection.update({
    where: { id: inspectionId },
    data: { formPayload: serializeFormPayload({ ...payload, media }) },
  });

  if (removed?.path && !removed.defectId) {
    try {
      const abs = resolveExistingPhotoPath(removed.path);
      if (abs) await fs.unlink(abs);
    } catch {
      /* ignore missing file */
    }
  }

  revalidatePath(`/inspections/${inspectionId}`);
  return NextResponse.json({ ok: true, media });
}
