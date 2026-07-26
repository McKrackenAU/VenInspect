import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canViewInspection, canEditInspection } from "@/lib/inspection-access";
import {
  parseFormPayload,
  serializeFormPayload,
} from "@/lib/inspection-templates";
import { getExportConfig } from "@/lib/export-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type ExportPhotoDto = {
  key: string;
  label: string;
  detail?: string;
  /** Defect condition state (CS1…); form photos omit this */
  severity?: string | null;
};

function buildPhotoList(
  defects: {
    id: string;
    defectCode: string;
    description: string;
    severity: string;
    photoPath: string | null;
    comparisonPhotoPath: string | null;
    subcategory: string | null;
    category: string | null;
  }[],
  media: Record<string, { id: string; path: string; caption?: string }[]>,
  includeComparison: boolean,
): ExportPhotoDto[] {
  const list: ExportPhotoDto[] = [];
  for (const d of defects) {
    if (d.photoPath) {
      list.push({
        key: `defect:${d.id}:current`,
        label: `${d.defectCode} (current)`,
        detail: d.description,
        severity: d.severity,
      });
    }
    if (includeComparison && d.comparisonPhotoPath) {
      list.push({
        key: `defect:${d.id}:comparison`,
        label: `${d.defectCode} (comparison)`,
        detail: d.description,
        severity: d.severity,
      });
    }
  }
  for (const [sectionKey, items] of Object.entries(media)) {
    for (const item of items) {
      list.push({
        key: `form:${item.id}`,
        label: item.caption || `Form photo`,
        detail: sectionKey,
        severity: null,
      });
    }
  }
  return list;
}

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
    include: { defects: { orderBy: { defectCode: "asc" } } },
  });
  if (!inspection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canViewInspection(user, inspection)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = parseFormPayload(inspection.formPayload);
  const exportCfg = getExportConfig();
  const photos = buildPhotoList(
    inspection.defects,
    payload.media ?? {},
    exportCfg.includeComparisonPhotos,
  );
  const order =
    payload.exportPhotoOrder?.filter((k) => photos.some((p) => p.key === k)) ??
    [];
  const missing = photos.map((p) => p.key).filter((k) => !order.includes(k));

  return NextResponse.json({
    photos,
    order: [...order, ...missing],
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
  const inspection = await prisma.inspection.findUnique({ where: { id } });
  if (!inspection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canEditInspection(user, inspection) && user.role !== "ADMIN") {
    // Allow any viewer who can export to save preferred order as admin/creator preferred —
    // soft: allow anyone who can view to persist order for pack consistency
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
  const next = {
    ...current,
    exportPhotoOrder: Array.isArray(body.order)
      ? body.order.map(String)
      : current.exportPhotoOrder,
  };

  await prisma.inspection.update({
    where: { id },
    data: { formPayload: serializeFormPayload(next) },
  });
  revalidatePath(`/inspections/${id}/report`);
  return NextResponse.json({ ok: true });
}
