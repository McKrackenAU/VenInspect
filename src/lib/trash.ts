"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tryUnlinkPhoto } from "@/lib/defect-photos";
import { parseFormPayload } from "@/lib/inspection-template-types";
import { verifyPassword } from "@/lib/passwords";
import { getPhotoDir, inspectionPhotoRelativeDir } from "@/lib/paths";

const TRASH_DAYS = 30;

/** Collect every relative photo/document path tied to an inspection. */
export async function collectInspectionFilePaths(
  inspectionId: string,
): Promise<string[]> {
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: {
      defects: { include: { photos: true } },
      mappingOverlays: true,
    },
  });
  if (!inspection) return [];

  const paths = new Set<string>();
  for (const d of inspection.defects) {
    if (d.photoPath) paths.add(d.photoPath);
    if (d.comparisonPhotoPath) paths.add(d.comparisonPhotoPath);
    for (const p of d.photos) {
      if (p.path) paths.add(p.path);
    }
  }
  for (const o of inspection.mappingOverlays) {
    if (o.imagePath) paths.add(o.imagePath);
  }

  const media = parseFormPayload(inspection.formPayload).media ?? {};
  for (const list of Object.values(media)) {
    for (const item of list) {
      if (item.path) paths.add(item.path);
    }
  }

  try {
    const register = await prisma.photoRegisterEntry.findMany({
      where: { inspectionId },
      select: { path: true },
    });
    for (const row of register) {
      if (row.path) paths.add(row.path);
    }
  } catch {
    /* table may not exist on very old DBs */
  }

  return [...paths];
}

/**
 * Hard-delete an inspection: remove photo files + inspection folder, then DB row
 * (cascades defects, photos rows, register, overlays, etc.).
 */
export async function permanentlyDeleteInspection(
  inspectionId: string,
): Promise<{ filesRemoved: number }> {
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { asset: true },
  });
  if (!inspection) {
    throw new Error("Inspection not found");
  }

  const relPaths = await collectInspectionFilePaths(inspectionId);
  let filesRemoved = 0;
  for (const rel of relPaths) {
    try {
      await tryUnlinkPhoto(rel);
      filesRemoved += 1;
    } catch {
      /* best-effort */
    }
  }

  // Remove the inspection's photo folder tree (Road/Asset/folderKey)
  try {
    const relDir = inspectionPhotoRelativeDir({
      roadName: inspection.asset.roadName || "Unknown Road",
      assetNumber: inspection.asset.assetNumber,
      folderKey: inspection.folderKey,
    });
    const absDir = path.join(getPhotoDir(), ...relDir.split("/"));
    const photoRoot = path.resolve(getPhotoDir());
    const resolved = path.resolve(absDir);
    if (resolved === photoRoot || !resolved.startsWith(photoRoot + path.sep)) {
      throw new Error("Refusing to delete outside photo root");
    }
    await fs.rm(resolved, { recursive: true, force: true });
  } catch {
    /* folder may already be gone or empty */
  }

  await prisma.inspection.delete({ where: { id: inspectionId } });
  return { filesRemoved };
}

export async function softDeleteInspectionAction(formData: FormData) {
  const actor = await requireUser();
  const id = String(formData.get("inspectionId") ?? "");
  const inspection = await prisma.inspection.findUniqueOrThrow({ where: { id } });
  if (actor.role !== "ADMIN" && inspection.createdById !== actor.id) {
    throw new Error("Cannot delete");
  }
  await prisma.inspection.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById: actor.id },
  });
  revalidatePath("/");
  revalidatePath("/manage/trash");
  revalidatePath(`/assets/${inspection.assetId}`);
  redirect(`/assets/${inspection.assetId}`);
}

export async function restoreInspectionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("inspectionId") ?? "");
  const inspection = await prisma.inspection.update({
    where: { id },
    data: { deletedAt: null, deletedById: null },
  });
  revalidatePath("/manage/trash");
  revalidatePath(`/inspections/${id}`);
  redirect(`/inspections/${id}`);
}

async function assertAdminPassword(password: string, adminId: string) {
  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
  if (!dbUser.passwordHash || !verifyPassword(password, dbUser.passwordHash)) {
    throw new Error("Incorrect password");
  }
}

function parseIdList(formData: FormData): string[] {
  const raw = String(formData.get("ids") ?? "").trim();
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(/[\n,|]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/** Bulk soft-delete (move to Trash). Confirm word DELETE + admin password. */
export async function bulkTrashInspectionsAction(formData: FormData): Promise<{
  ok: true;
  count: number;
}> {
  const admin = await requireAdmin();
  const password = String(formData.get("password") ?? "");
  const confirmText = String(formData.get("confirmText") ?? "").trim();
  const ids = parseIdList(formData);
  if (!ids.length) throw new Error("Select at least one report");
  if (!password) throw new Error("Password required");
  if (confirmText !== "DELETE") {
    throw new Error('Type DELETE to confirm bulk move to Trash');
  }
  await assertAdminPassword(password, admin.id);

  const result = await prisma.inspection.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data: { deletedAt: new Date(), deletedById: admin.id },
  });

  revalidatePath("/manage/trash");
  revalidatePath("/manage/reports");
  revalidatePath("/manage");
  revalidatePath("/assets");
  return { ok: true, count: result.count };
}

/**
 * Bulk permanent delete (live or trashed). Removes photos + DB rows.
 * Confirm word PURGE + admin password.
 */
export async function bulkPurgeInspectionsAction(formData: FormData): Promise<{
  ok: true;
  purged: number;
  filesRemoved: number;
}> {
  const admin = await requireAdmin();
  const password = String(formData.get("password") ?? "");
  const confirmText = String(formData.get("confirmText") ?? "").trim();
  const ids = parseIdList(formData);
  if (!ids.length) throw new Error("Select at least one report");
  if (!password) throw new Error("Password required");
  if (confirmText !== "PURGE") {
    throw new Error("Type PURGE to permanently delete selected reports and photos");
  }
  await assertAdminPassword(password, admin.id);

  let filesRemoved = 0;
  let purged = 0;
  const assetIds = new Set<string>();
  for (const id of ids) {
    const row = await prisma.inspection.findUnique({
      where: { id },
      select: { id: true, assetId: true },
    });
    if (!row) continue;
    const result = await permanentlyDeleteInspection(id);
    filesRemoved += result.filesRemoved;
    purged += 1;
    assetIds.add(row.assetId);
  }

  revalidatePath("/manage/trash");
  revalidatePath("/manage/reports");
  revalidatePath("/manage");
  for (const assetId of assetIds) {
    revalidatePath(`/assets/${assetId}`);
    revalidatePath(`/manage/assets/${assetId}`);
  }
  return { ok: true, purged, filesRemoved };
}

/** Purge one trashed report now (files + DB). */
export async function purgeTrashItemAction(formData: FormData): Promise<{
  ok: true;
  filesRemoved: number;
}> {
  const admin = await requireAdmin();
  const id = String(formData.get("inspectionId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!id) throw new Error("Inspection required");
  if (!password) throw new Error("Password required");
  await assertAdminPassword(password, admin.id);

  const inspection = await prisma.inspection.findUnique({ where: { id } });
  if (!inspection) throw new Error("Inspection not found");
  if (!inspection.deletedAt) {
    throw new Error("Only items in Trash can be purged. Move it to Trash first.");
  }

  const { filesRemoved } = await permanentlyDeleteInspection(id);
  revalidatePath("/manage/trash");
  revalidatePath(`/assets/${inspection.assetId}`);
  revalidatePath(`/manage/assets/${inspection.assetId}`);
  return { ok: true, filesRemoved };
}

/** Purge all currently trashed reports (or only those older than 30 days). */
export async function purgeTrashAction(formData: FormData): Promise<{
  ok: true;
  purged: number;
  filesRemoved: number;
}> {
  const admin = await requireAdmin();
  const password = String(formData.get("password") ?? "");
  const mode = String(formData.get("mode") ?? "old").trim(); // old | all
  if (!password) throw new Error("Password required");
  await assertAdminPassword(password, admin.id);

  const where =
    mode === "all"
      ? { deletedAt: { not: null as Date | null } }
      : {
          deletedAt: {
            lt: new Date(Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000),
          },
        };

  const rows = await prisma.inspection.findMany({
    where,
    select: { id: true, assetId: true },
  });

  let filesRemoved = 0;
  const assetIds = new Set<string>();
  for (const row of rows) {
    const result = await permanentlyDeleteInspection(row.id);
    filesRemoved += result.filesRemoved;
    assetIds.add(row.assetId);
  }

  revalidatePath("/manage/trash");
  for (const assetId of assetIds) {
    revalidatePath(`/assets/${assetId}`);
    revalidatePath(`/manage/assets/${assetId}`);
  }
  return { ok: true, purged: rows.length, filesRemoved };
}

