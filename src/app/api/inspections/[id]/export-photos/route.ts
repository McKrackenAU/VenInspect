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
import {
  buildExportPhotoPool,
  mergeExportPhotoOrder,
} from "@/lib/export-photos";

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

  // Ordering UI always includes general/form photos (report pool), even if ZIP
  // config later omits them — user can still see and order everything.
  const pool = buildExportPhotoPool(
    inspection.defects,
    payload.media ?? {},
    {
      includeComparison: exportCfg.includeComparisonPhotos,
      includeFormPhotos: true,
      template,
    },
  );

  const photos = pool.map(({ path: _path, ...rest }) => rest);
  const order = mergeExportPhotoOrder(payload.exportPhotoOrder, pool);

  return NextResponse.json({
    photos,
    order,
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
  revalidatePath(`/inspections/${id}/client-export`);
  return NextResponse.json({ ok: true });
}
