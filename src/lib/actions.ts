"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, requireAdmin, requireUser } from "@/lib/auth";
import { nextDefectCode } from "@/lib/inspection";
import { saveCompressedDefectPhoto } from "@/lib/photos";
import {
  allocateInspectionFolderKey,
  buildInspectionLabel,
  ensureDataDirs,
  writeStorageSettings,
} from "@/lib/paths";
import type { DefectSeverity, InspectionLevel } from "@/generated/prisma/client";

export async function createInspection(formData: FormData) {
  const assetId = String(formData.get("assetId") ?? "");
  const level = String(formData.get("level") ?? "LEVEL_1") as InspectionLevel;
  const generalComments = String(formData.get("generalComments") ?? "") || null;
  const actor = await requireUser();

  if (!assetId) throw new Error("Asset required");

  if (level === "LEVEL_2" && !actor.level2Qualified && !actor.level1Qualified) {
    throw new Error("Inspector not qualified");
  }

  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  const submittedAt = new Date();
  const existing = await prisma.inspection.findMany({
    where: { assetId },
    select: { folderKey: true },
  });
  const { folderKey, includeTimeInLabel } = allocateInspectionFolderKey(
    submittedAt,
    existing.map((e) => e.folderKey),
  );
  const roadName = asset.roadName || "Unknown Road";
  const titleLabel = buildInspectionLabel({
    roadName,
    assetNumber: asset.assetNumber,
    at: submittedAt,
    includeTime: includeTimeInLabel,
  });

  ensureDataDirs();

  const requiresLevel2Approval = level === "LEVEL_2" && !actor.level2Qualified;
  const status = requiresLevel2Approval ? "PENDING_APPROVAL" : "SUBMITTED";

  const inspection = await prisma.inspection.create({
    data: {
      assetId,
      level,
      status,
      generalComments,
      createdById: actor.id,
      submittedAt,
      inspectedAt: submittedAt,
      requiresLevel2Approval,
      folderKey,
      titleLabel,
      relationKind: "STANDALONE",
    },
    include: { asset: true },
  });

  const cats =
    inspection.asset.type === "BRIDGE"
      ? [
          ["Approaches", "Approach A"],
          ["Superstructure", "Deck"],
          ["Substructure", "Abutment A"],
          ["Waterway", "Channel"],
        ]
      : inspection.asset.type === "NOISE_WALL"
        ? [
            ["Panels", "Face"],
            ["Structure", "Posts"],
            ["Surrounds", "Access"],
          ]
        : [
            ["Drainage", "Inlet"],
            ["Drainage", "Outlet"],
            ["Drainage", "Barrel"],
          ];

  await prisma.inspectionCategory.createMany({
    data: cats.map(([category, subcategory]) => ({
      inspectionId: inspection.id,
      category,
      subcategory,
      comments: null,
    })),
  });

  if (requiresLevel2Approval) {
    const level2Users = await prisma.user.findMany({
      where: { level2Qualified: true },
    });
    await prisma.notification.createMany({
      data: level2Users.map((u) => ({
        userId: u.id,
        inspectionId: inspection.id,
        title: "Level 2 verification required",
        message: `${titleLabel} — Level 2 draft by ${actor.name} needs verification.`,
      })),
    });
  }

  revalidatePath("/");
  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/approvals");
  revalidatePath(`/inspections/${inspection.id}`);

  redirect(`/inspections/${inspection.id}`);
}

export async function updateCategoryComment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const comments = String(formData.get("comments") ?? "");
  const row = await prisma.inspectionCategory.update({
    where: { id },
    data: { comments },
  });
  revalidatePath(`/inspections/${row.inspectionId}`);
}

export async function addDefect(formData: FormData) {
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const comments = String(formData.get("comments") ?? "") || null;
  const category = String(formData.get("category") ?? "") || null;
  const subcategory = String(formData.get("subcategory") ?? "") || null;
  const severity = (String(formData.get("severity") ?? "MEDIUM") ||
    "MEDIUM") as DefectSeverity;
  const photo = formData.get("photo");

  if (!inspectionId || !description) {
    throw new Error("Inspection and description required");
  }

  if (!(photo instanceof File) || photo.size === 0) {
    throw new Error("Defect photo is required");
  }

  const inspection = await prisma.inspection.findUniqueOrThrow({
    where: { id: inspectionId },
    include: { asset: true, defects: true },
  });

  const defectCode = nextDefectCode(
    inspection.asset.assetNumber,
    inspection.defects.map((d) => d.defectCode),
  );

  const buffer = Buffer.from(await photo.arrayBuffer());
  const { relativePath } = await saveCompressedDefectPhoto({
    buffer,
    roadName: inspection.asset.roadName || "Unknown Road",
    assetNumber: inspection.asset.assetNumber,
    folderKey: inspection.folderKey,
    defectCode,
  });

  await prisma.defect.create({
    data: {
      inspectionId,
      defectCode,
      description,
      comments,
      category,
      subcategory,
      severity,
      photoPath: relativePath,
    },
  });

  revalidatePath(`/inspections/${inspectionId}`);
}

export async function approveInspection(formData: FormData) {
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const approver = await requireUser();

  if (!approver.level2Qualified && approver.role !== "ADMIN") {
    throw new Error("Approver must be Level 2 qualified");
  }

  await prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      status: "APPROVED",
      approvedById: approver.id,
      approvedAt: new Date(),
    },
  });

  await prisma.notification.updateMany({
    where: { inspectionId, read: false },
    data: { read: true },
  });

  revalidatePath("/approvals");
  revalidatePath(`/inspections/${inspectionId}`);
  revalidatePath("/");
}

export async function rejectInspection(formData: FormData) {
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const approver = await requireUser();

  await prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      status: "REJECTED",
      approvedById: approver.id,
    },
  });

  revalidatePath("/approvals");
  revalidatePath(`/inspections/${inspectionId}`);
}

export async function createUser(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const username =
    String(formData.get("username") ?? "").trim().toLowerCase() || null;
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "INSPECTOR") as "ADMIN" | "INSPECTOR";
  const level1Qualified = formData.get("level1Qualified") === "on";
  const level2Qualified = formData.get("level2Qualified") === "on";

  if (!name || !email) throw new Error("Name and email required");
  if (!password || password.length < 4) {
    throw new Error("Password required (min 4 characters)");
  }

  await prisma.user.create({
    data: {
      name,
      email,
      username,
      role,
      level1Qualified,
      level2Qualified,
      passwordHash: hashPassword(password),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/manage/users");
}

export async function updateUserQualifications(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "INSPECTOR") as "ADMIN" | "INSPECTOR";
  const level1Qualified = formData.get("level1Qualified") === "on";
  const level2Qualified = formData.get("level2Qualified") === "on";
  const password = String(formData.get("password") ?? "");

  await prisma.user.update({
    where: { id },
    data: {
      role,
      level1Qualified,
      level2Qualified,
      ...(password.length >= 4 ? { passwordHash: hashPassword(password) } : {}),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/manage/users");
}

export async function importAssetsFromFile(formData: FormData) {
  const file = formData.get("file");
  const mode = String(formData.get("mode") ?? "upsert"); // upsert | skip

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose an Excel (.xlsx) or CSV file");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { parseAssetWorkbook } = await import("@/lib/asset-import");
  const { rows, errors } = parseAssetWorkbook(buffer);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const existing = await prisma.asset.findUnique({
      where: { assetNumber: row.assetNumber },
    });

    if (existing && mode === "skip") {
      skipped += 1;
      continue;
    }

    const data = {
      assetVisionId: row.assetVisionId,
      name: row.name,
      type: row.type,
      roadName: row.roadName || row.parentAssetName || "Unknown Road",
      location: row.location,
      latitude: row.latitude,
      longitude: row.longitude,
      parentDirection: row.parentDirection,
      parentChainage: row.parentChainage,
      parentAssetCode: row.parentAssetCode,
      parentAssetName: row.parentAssetName,
      classification: row.classification,
      notes: row.notes,
    };

    if (existing) {
      await prisma.asset.update({
        where: { assetNumber: row.assetNumber },
        data,
      });
      updated += 1;
    } else {
      await prisma.asset.create({
        data: { assetNumber: row.assetNumber, ...data },
      });
      created += 1;
    }
  }

  revalidatePath("/manage/assets");
  revalidatePath("/assets");
  revalidatePath("/");

  return { created, updated, skipped, errors, total: rows.length };
}

export async function upsertAssetManual(formData: FormData) {
  const assetNumber = String(formData.get("assetNumber") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "BRIDGE") as
    | "BRIDGE"
    | "DRAINAGE"
    | "NOISE_WALL";
  const assetVisionId = String(formData.get("assetVisionId") ?? "").trim() || null;
  const roadName = String(formData.get("roadName") ?? "").trim() || "Unknown Road";
  const location = String(formData.get("location") ?? "").trim() || null;
  const latitudeRaw = String(formData.get("latitude") ?? "").trim();
  const longitudeRaw = String(formData.get("longitude") ?? "").trim();
  const latitude = latitudeRaw ? Number(latitudeRaw) : null;
  const longitude = longitudeRaw ? Number(longitudeRaw) : null;

  if (!assetNumber || !name) throw new Error("Code and name required");

  await prisma.asset.upsert({
    where: { assetNumber },
    create: {
      assetNumber,
      name,
      type,
      assetVisionId,
      roadName,
      location,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
    },
    update: {
      name,
      type,
      assetVisionId,
      roadName,
      location,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
    },
  });

  revalidatePath("/manage/assets");
  revalidatePath("/assets");
  redirect("/manage/assets");
}

export async function savePhotoStoragePath(formData: FormData) {
  const photoDir = String(formData.get("photoDir") ?? "").trim();
  if (process.env.PHOTO_DIR?.trim()) {
    throw new Error(
      "PHOTO_DIR is set in the environment and takes priority. Update /etc/veninspect.env (or .env) instead.",
    );
  }
  // Empty clears override → fall back to {DATA_DIR}/photos
  writeStorageSettings({ photoDir: photoDir || undefined });
  ensureDataDirs();
  revalidatePath("/manage/storage");
  redirect("/manage/storage");
}

/** Attach this inspection as a child of another (same asset preferred). */
export async function linkAsChildInspection(formData: FormData) {
  const childId = String(formData.get("childId") ?? "");
  const parentId = String(formData.get("parentId") ?? "");
  if (!childId || !parentId || childId === parentId) {
    throw new Error("Select a valid parent inspection");
  }

  const [child, parent] = await Promise.all([
    prisma.inspection.findUniqueOrThrow({ where: { id: childId } }),
    prisma.inspection.findUniqueOrThrow({ where: { id: parentId } }),
  ]);

  if (child.assetId !== parent.assetId) {
    throw new Error("Parent and child must be on the same asset");
  }

  await prisma.inspection.update({
    where: { id: parentId },
    data: { relationKind: "PARENT", parentInspectionId: null },
  });
  await prisma.inspection.update({
    where: { id: childId },
    data: { relationKind: "CHILD", parentInspectionId: parentId },
  });

  revalidatePath(`/inspections/${childId}`);
  revalidatePath(`/inspections/${parentId}`);
  revalidatePath(`/assets/${child.assetId}`);
}

export async function unlinkChildInspection(formData: FormData) {
  const childId = String(formData.get("childId") ?? "");
  const child = await prisma.inspection.update({
    where: { id: childId },
    data: { relationKind: "STANDALONE", parentInspectionId: null },
  });

  const siblings = await prisma.inspection.count({
    where: { parentInspectionId: child.parentInspectionId ?? "__none__" },
  });
  // If parent had this as only child, leave parent as PARENT or reset — check remaining children
  // (parentInspectionId already cleared on child; fetch previous via form if needed)
  void siblings;

  revalidatePath(`/inspections/${childId}`);
  revalidatePath(`/assets/${child.assetId}`);
}

/** Create an empty parent shell and attach two existing inspections as children (combine). */
export async function combineInspectionsAsParent(formData: FormData) {
  const assetId = String(formData.get("assetId") ?? "");
  const aId = String(formData.get("inspectionA") ?? "");
  const bId = String(formData.get("inspectionB") ?? "");
  const actor = await requireUser();

  if (!assetId || !aId || !bId || aId === bId) {
    throw new Error("Select two different inspections on the asset");
  }

  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  const submittedAt = new Date();
  const existing = await prisma.inspection.findMany({
    where: { assetId },
    select: { folderKey: true },
  });
  const { folderKey, includeTimeInLabel } = allocateInspectionFolderKey(
    submittedAt,
    existing.map((e) => e.folderKey),
  );
  const titleLabel = `${buildInspectionLabel({
    roadName: asset.roadName || "Unknown Road",
    assetNumber: asset.assetNumber,
    at: submittedAt,
    includeTime: includeTimeInLabel,
  })} (combined)`;

  const parent = await prisma.inspection.create({
    data: {
      assetId,
      level: "LEVEL_1",
      status: "DRAFT",
      createdById: actor.id,
      submittedAt,
      inspectedAt: submittedAt,
      folderKey,
      titleLabel,
      relationKind: "PARENT",
      generalComments: "Combined parent report — children linked below.",
    },
  });

  await prisma.inspection.updateMany({
    where: { id: { in: [aId, bId] } },
    data: { relationKind: "CHILD", parentInspectionId: parent.id },
  });

  revalidatePath(`/assets/${assetId}`);
  redirect(`/inspections/${parent.id}`);
}
