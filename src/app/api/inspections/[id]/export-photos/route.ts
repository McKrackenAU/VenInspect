import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canViewInspection, canEditInspection } from "@/lib/inspection-access";
import {
  parseFormPayload,
  serializeFormPayload,
} from "@/lib/inspection-templates";
import { getTemplateForLevel } from "@/lib/inspection-templates";
import { getExportConfig } from "@/lib/export-config";
import { buildExportPhotoPool } from "@/lib/export-photos";
import {
  attachFormMediaTakenAt,
  buildRegisterRewriteItems,
  enrichExportPhotosWithRegister,
  loadPhotoRegister,
  rewritePhotoRegister,
} from "@/lib/photo-register";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { id } = await context.params;
  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: {
      asset: true,
      defects: {
        orderBy: [{ sortOrder: "asc" }, { defectCode: "asc" }],
        include: { photos: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!inspection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canViewInspection(user, inspection)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = parseFormPayload(inspection.formPayload);
  const exportCfg = getExportConfig();
  const template = getTemplateForLevel(inspection.level);

  const pool = attachFormMediaTakenAt(
    buildExportPhotoPool(inspection.defects, payload.media ?? {}, {
      includeComparison: exportCfg.includeComparisonPhotos,
      includeFormPhotos: true,
      template,
    }),
    payload.media ?? {},
  );

  const registerRows = await loadPhotoRegister(id);
  const { photos, order } = enrichExportPhotosWithRegister({
    pool,
    assetNumber: inspection.asset.assetNumber,
    inspectedAt: inspection.inspectedAt,
    registerRows,
    legacyOrder: payload.exportPhotoOrder,
  });

  // Strip storage path from client response
  const clientPhotos = photos.map((p) => {
    const { path: _omit, ...rest } = p;
    void _omit;
    return rest;
  });

  return NextResponse.json({
    photos: clientPhotos,
    order,
    assetNumber: inspection.asset.assetNumber,
  });
}

export async function PUT(
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
    include: {
      asset: true,
      defects: {
        orderBy: [{ sortOrder: "asc" }, { defectCode: "asc" }],
        include: { photos: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!inspection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canEditInspection(user, inspection) && user.role !== "ADMIN") {
    if (!canViewInspection(user, inspection)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let body: { order?: string[] };
  try {
    body = (await req.json()) as { order?: string[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const current = parseFormPayload(inspection.formPayload);
  const order = Array.isArray(body.order)
    ? body.order.map(String)
    : current.exportPhotoOrder ?? [];

  const exportCfg = getExportConfig();
  const template = getTemplateForLevel(inspection.level);
  const pool = attachFormMediaTakenAt(
    buildExportPhotoPool(inspection.defects, current.media ?? {}, {
      includeComparison: exportCfg.includeComparisonPhotos,
      includeFormPhotos: true,
      template,
    }),
    current.media ?? {},
  );

  const registerRows = await loadPhotoRegister(id);
  const items = buildRegisterRewriteItems({
    orderedKeys: order,
    pool,
    registerRows,
    inspectedAt: inspection.inspectedAt,
  });
  await rewritePhotoRegister({ inspectionId: id, items });

  const next = {
    ...current,
    exportPhotoOrder: items.map((i) => i.photoKey),
  };

  await prisma.inspection.update({
    where: { id },
    data: { formPayload: serializeFormPayload(next) },
  });

  const enriched = enrichExportPhotosWithRegister({
    pool,
    assetNumber: inspection.asset.assetNumber,
    inspectedAt: inspection.inspectedAt,
    registerRows: items.map((item, i) => ({
      photoKey: item.photoKey,
      takenAt: item.takenAt,
      registerNo: i + 1,
      sortOrder: i + 1,
    })),
    legacyOrder: next.exportPhotoOrder,
  });

  revalidatePath(`/inspections/${id}/report`);
  revalidatePath(`/inspections/${id}/client-export`);
  return NextResponse.json({
    ok: true,
    order: enriched.order,
    photos: enriched.photos.map((p) => {
      const { path: _omit, ...rest } = p;
      void _omit;
      return rest;
    }),
  });
}
