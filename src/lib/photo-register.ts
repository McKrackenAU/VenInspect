import { prisma } from "@/lib/db";
import { formatDotPhotoName } from "@/lib/dot-photo-register";
import type { ExportPhotoListItem } from "@/lib/export-photos";
import { mergeExportPhotoOrder } from "@/lib/export-photos";
import type { FormMediaItem } from "@/lib/inspection-template-types";

export type RegisterSourcePhoto = ExportPhotoListItem & {
  takenAt?: Date | string | null;
  createdAt?: Date | string | null;
};

function asDate(value: Date | string | null | undefined, fallback: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback;
}

/** Resolve capture date for a pool item (register → photo → created → inspected). */
export function resolvePoolTakenAt(
  item: RegisterSourcePhoto,
  registerTakenAt: Date | null | undefined,
  inspectedAt: Date,
): Date {
  if (registerTakenAt) return registerTakenAt;
  if (item.takenAt) return asDate(item.takenAt, inspectedAt);
  if (item.createdAt) return asDate(item.createdAt, inspectedAt);
  return inspectedAt;
}

export function formatRegisterDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export type EnrichedExportPhoto = ExportPhotoListItem & {
  takenAt: string;
  registerNo: number;
  previewName: string;
  dateLabel: string;
};

/**
 * Merge saved register / legacy order with the current pool and attach
 * provisional register numbers + DoT preview names (does not write SQL).
 */
export function enrichExportPhotosWithRegister(opts: {
  pool: RegisterSourcePhoto[];
  assetNumber: string;
  inspectedAt: Date;
  registerRows: {
    photoKey: string;
    takenAt: Date;
    registerNo: number;
    sortOrder: number;
  }[];
  legacyOrder?: string[];
}): { photos: EnrichedExportPhoto[]; order: string[] } {
  const byKey = new Map(opts.registerRows.map((r) => [r.photoKey, r]));
  const registerOrder = [...opts.registerRows]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.registerNo - b.registerNo)
    .map((r) => r.photoKey);
  const order = mergeExportPhotoOrder(
    registerOrder.length ? registerOrder : opts.legacyOrder,
    opts.pool,
  );
  const poolByKey = new Map(opts.pool.map((p) => [p.key, p]));

  const photos: EnrichedExportPhoto[] = order
    .map((key, i) => {
      const item = poolByKey.get(key);
      if (!item) return null;
      const reg = byKey.get(key);
      const takenAt = resolvePoolTakenAt(item, reg?.takenAt, opts.inspectedAt);
      const registerNo = i + 1;
      const previewName = formatDotPhotoName({
        assetNumber: opts.assetNumber,
        takenAt,
        sequence: registerNo,
      });
      return {
        ...item,
        takenAt: takenAt.toISOString(),
        registerNo,
        previewName,
        dateLabel: formatRegisterDate(takenAt),
      };
    })
    .filter((p): p is EnrichedExportPhoto => !!p);

  return { photos, order };
}

/** Rewrite PhotoRegisterEntry rows for an inspection (1…n in given order). */
export async function rewritePhotoRegister(opts: {
  inspectionId: string;
  items: { photoKey: string; takenAt: Date; path: string }[];
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.photoRegisterEntry.deleteMany({
      where: { inspectionId: opts.inspectionId },
    });
    if (!opts.items.length) return;
    await tx.photoRegisterEntry.createMany({
      data: opts.items.map((item, i) => ({
        inspectionId: opts.inspectionId,
        photoKey: item.photoKey,
        takenAt: item.takenAt,
        registerNo: i + 1,
        sortOrder: i + 1,
        path: item.path,
      })),
    });
  });
}

export async function loadPhotoRegister(inspectionId: string) {
  return prisma.photoRegisterEntry.findMany({
    where: { inspectionId },
    orderBy: [{ sortOrder: "asc" }, { registerNo: "asc" }],
  });
}

/** Build rewrite payload from ordered keys + pool + prior register takenAts. */
export function buildRegisterRewriteItems(opts: {
  orderedKeys: string[];
  pool: RegisterSourcePhoto[];
  registerRows: { photoKey: string; takenAt: Date }[];
  inspectedAt: Date;
}): { photoKey: string; takenAt: Date; path: string }[] {
  const poolByKey = new Map(opts.pool.map((p) => [p.key, p]));
  const regByKey = new Map(opts.registerRows.map((r) => [r.photoKey, r]));
  const items: { photoKey: string; takenAt: Date; path: string }[] = [];
  for (const key of opts.orderedKeys) {
    const item = poolByKey.get(key);
    if (!item?.path) continue;
    const takenAt = resolvePoolTakenAt(
      item,
      regByKey.get(key)?.takenAt,
      opts.inspectedAt,
    );
    items.push({ photoKey: key, takenAt, path: item.path });
  }
  return items;
}

/** Attach takenAt from form media JSON onto pool items (mutates copies). */
export function attachFormMediaTakenAt(
  pool: ExportPhotoListItem[],
  media: Record<string, FormMediaItem[]>,
): RegisterSourcePhoto[] {
  const byFormId = new Map<string, FormMediaItem>();
  for (const list of Object.values(media)) {
    for (const m of list) byFormId.set(m.id, m);
  }
  return pool.map((p) => {
    if (!p.key.startsWith("form:")) return p;
    const id = p.key.slice("form:".length);
    const m = byFormId.get(id);
    return {
      ...p,
      takenAt: m?.takenAt ?? null,
    };
  });
}
