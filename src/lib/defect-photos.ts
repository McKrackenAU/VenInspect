import { prisma } from "@/lib/db";
import { nextDefectCode } from "@/lib/inspection";
import { resolveExistingPhotoPath } from "@/lib/photo-resolve";
import fs from "node:fs/promises";

export const MAX_DEFECT_PHOTOS = 100;

export async function renumberDefects(inspectionId: string, assetNumber: string) {
  const defects = await prisma.defect.findMany({
    where: { inspectionId },
    orderBy: [{ sortOrder: "asc" }, { defectCode: "asc" }, { createdAt: "asc" }],
  });

  for (let i = 0; i < defects.length; i++) {
    const d = defects[i]!;
    const code = `${assetNumber}-D${String(i + 1).padStart(3, "0")}`;
    if (d.defectCode === code && d.sortOrder === i) continue;
    // Temporarily unique-safe rename if collision
    const temp = `${code}__tmp_${d.id.slice(-6)}`;
    await prisma.defect.update({
      where: { id: d.id },
      data: { defectCode: temp, sortOrder: i },
    });
  }

  const again = await prisma.defect.findMany({
    where: { inspectionId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  for (let i = 0; i < again.length; i++) {
    const d = again[i]!;
    const code = `${assetNumber}-D${String(i + 1).padStart(3, "0")}`;
    await prisma.defect.update({
      where: { id: d.id },
      data: { defectCode: code, sortOrder: i },
    });
  }
}

export async function addPhotosToDefect(opts: {
  defectId: string;
  inspection: {
    folderKey: string;
    asset: { roadName: string | null; assetNumber: string };
  };
  defectCode: string;
  files: {
    buffer: Buffer;
    originalName: string;
    caption?: string;
    kind?: string;
    fileLastModifiedMs?: number | null;
  }[];
}) {
  const existing = await prisma.defectPhoto.count({ where: { defectId: opts.defectId } });
  if (existing + opts.files.length > MAX_DEFECT_PHOTOS) {
    throw new Error(`Maximum ${MAX_DEFECT_PHOTOS} photos per defect`);
  }

  const { saveCompressedDefectPhoto } = await import("@/lib/photos");
  const created = [];
  let order = existing;
  for (const file of opts.files) {
    const { relativePath, takenAt } = await saveCompressedDefectPhoto({
      buffer: file.buffer,
      roadName: opts.inspection.asset.roadName || "Unknown Road",
      assetNumber: opts.inspection.asset.assetNumber,
      folderKey: opts.inspection.folderKey,
      defectCode: `${opts.defectCode}-P${String(order + 1).padStart(3, "0")}`,
      originalName: file.originalName,
      fileLastModifiedMs: file.fileLastModifiedMs ?? null,
    });
    const row = await prisma.defectPhoto.create({
      data: {
        defectId: opts.defectId,
        path: relativePath,
        caption: file.caption ?? null,
        kind: file.kind ?? "other",
        sortOrder: order,
        takenAt,
      },
    });
    created.push(row);
    order += 1;
  }

  // Keep legacy photoPath pointing at first photo
  const first = await prisma.defectPhoto.findFirst({
    where: { defectId: opts.defectId },
    orderBy: { sortOrder: "asc" },
  });
  if (first) {
    await prisma.defect.update({
      where: { id: opts.defectId },
      data: { photoPath: first.path },
    });
  }
  return created;
}

export async function breakoutDefectPhotos(opts: {
  defectId: string;
  photoIds: string[];
  inspectionId: string;
  assetNumber: string;
}) {
  const source = await prisma.defect.findUniqueOrThrow({
    where: { id: opts.defectId },
    include: { photos: true },
  });
  const selected = source.photos.filter((p) => opts.photoIds.includes(p.id));
  if (!selected.length) throw new Error("Select at least one photo to break out");

  const siblings = await prisma.defect.findMany({
    where: { inspectionId: opts.inspectionId },
    select: { defectCode: true, sortOrder: true },
  });
  let maxSort = Math.max(0, ...siblings.map((s) => s.sortOrder));

  const createdIds: string[] = [];
  for (const photo of selected) {
    maxSort += 1;
    const code = nextDefectCode(
      opts.assetNumber,
      (
        await prisma.defect.findMany({
          where: { inspectionId: opts.inspectionId },
          select: { defectCode: true },
        })
      ).map((d) => d.defectCode),
    );
    const neu = await prisma.defect.create({
      data: {
        inspectionId: opts.inspectionId,
        defectCode: code,
        sortOrder: maxSort,
        category: source.category,
        subcategory: source.subcategory,
        componentId: source.componentId,
        groupName: source.groupName,
        groupNumber: source.groupNumber,
        componentNumber: source.componentNumber,
        locationDetail: source.locationDetail,
        defectQty: source.defectQty,
        defectUnit: source.defectUnit,
        treatmentType: source.treatmentType,
        treatmentTimeframe: source.treatmentTimeframe,
        description: source.description,
        comments: source.comments,
        severity: source.severity,
        taskTypeId: source.taskTypeId,
        photoPath: photo.path,
        photos: {
          create: {
            path: photo.path,
            caption: photo.caption,
            kind: photo.kind,
            sortOrder: 0,
            takenAt: photo.takenAt,
          },
        },
      },
    });
    createdIds.push(neu.id);
    await prisma.defectPhoto.delete({ where: { id: photo.id } });
  }

  const remaining = await prisma.defectPhoto.count({ where: { defectId: opts.defectId } });
  if (remaining === 0) {
    await prisma.defect.delete({ where: { id: opts.defectId } });
  } else {
    const first = await prisma.defectPhoto.findFirst({
      where: { defectId: opts.defectId },
      orderBy: { sortOrder: "asc" },
    });
    await prisma.defect.update({
      where: { id: opts.defectId },
      data: { photoPath: first?.path ?? null },
    });
  }

  await renumberDefects(opts.inspectionId, opts.assetNumber);
  return createdIds;
}

/** Delete photo file if present (best-effort). */
export async function tryUnlinkPhoto(rel: string) {
  try {
    const abs = resolveExistingPhotoPath(rel);
    if (abs) await fs.unlink(abs);
  } catch {
    /* ignore */
  }
}

export function parseComponentsJson(raw: string | null | undefined): {
  id: string;
  name: string;
  qty?: string;
  unit?: string;
  category?: string;
}[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .map((r, i) => ({
        id: String(r.id ?? `c${i}`),
        name: String(r.name ?? `Component ${i + 1}`),
        qty: r.qty != null ? String(r.qty) : undefined,
        unit: r.unit != null ? String(r.unit) : undefined,
        category: r.category != null ? String(r.category) : undefined,
      }));
  } catch {
    return [];
  }
}

/** Suggest CS qty breakdown from defects tagged to a component. */
export function suggestCsFromDefects(
  componentQty: number,
  defects: { severity: string; defectQty: number | null }[],
): { cs1: number; cs2: number; cs3: number; cs4: number } {
  const buckets = { cs1: 0, cs2: 0, cs3: 0, cs4: 0 };
  for (const d of defects) {
    const q = d.defectQty != null && d.defectQty > 0 ? d.defectQty : 1;
    const s = d.severity.toUpperCase();
    if (s.includes("CS4") || s === "CRITICAL") buckets.cs4 += q;
    else if (s.includes("CS3") || s === "HIGH") buckets.cs3 += q;
    else if (s.includes("CS2") || s === "MEDIUM") buckets.cs2 += q;
    else buckets.cs1 += q;
  }
  const used = buckets.cs2 + buckets.cs3 + buckets.cs4;
  buckets.cs1 = Math.max(0, componentQty - used);
  return buckets;
}

export function csPercents(qty: number, cs1: number, cs2: number, cs3: number, cs4: number) {
  if (!qty || qty <= 0) return { pct1: "", pct2: "", pct3: "", pct4: "" };
  const pct = (n: number) => String(Math.round((n / qty) * 1000) / 10);
  return {
    pct1: pct(cs1),
    pct2: pct(cs2),
    pct3: pct(cs3),
    pct4: pct(cs4),
  };
}
