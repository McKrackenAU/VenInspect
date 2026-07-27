"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, requireAdmin, requireUser } from "@/lib/auth";
import { verifyPassword } from "@/lib/passwords";
import { validateNewPassword } from "@/lib/password-policy";
import { canApproveLevel2 } from "@/lib/report-people";
import { canEditInspection } from "@/lib/inspection-access";
import { nextDefectCode } from "@/lib/inspection";
import { saveCompressedDefectPhoto } from "@/lib/photos";
import {
  allocateInspectionFolderKey,
  buildInspectionLabel,
  ensureDataDirs,
  writeStorageSettings,
  absolutePhotoPath,
  inspectionPhotoRelativeDir,
} from "@/lib/paths";
import { saveSeverityOptions } from "@/lib/severities";
import { getInspectionTypes, inspectionTypeIntervalYears, saveInspectionTypes } from "@/lib/inspection-types";
import {
  getInspectionTemplates,
  getTemplateForLevel,
  resetTemplateToSeed,
  saveInspectionTemplates,
  type InspectionTemplate,
} from "@/lib/inspection-templates";
import { ASSET_PERMIT_FLAGS } from "@/lib/permits";
import { seedFormPayloadFromAsset } from "@/lib/form-seed";
import { serializeFormPayload } from "@/lib/inspection-template-types";
import { saveAssetTypes } from "@/lib/asset-types";
import { saveDocumentTags } from "@/lib/document-tags";
import {
  parseAssetComponents,
  serializeAssetComponents,
  serializeAssetProfile,
  parseAssetProfile,
  newComponentId,
  type AssetComponent,
} from "@/lib/asset-profile";
import { saveAssetDocumentFile } from "@/lib/photos";
import {
  parseAssetAuditExport,
  profileSyncHints,
} from "@/lib/asset-audit-import";

export async function createInspection(formData: FormData) {
  const assetId = String(formData.get("assetId") ?? "");
  const level = String(formData.get("level") ?? "LEVEL_1")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  const generalComments = String(formData.get("generalComments") ?? "") || null;
  const actor = await requireUser();

  if (!assetId) throw new Error("Asset required");

  const types = getInspectionTypes();
  const typeDef = types.find((t) => t.value === level);
  if (!typeDef) throw new Error("Unknown inspection type");

  if (
    (level === "LEVEL_2" || typeDef.requiresLevel2Approval) &&
    !actor.level2Qualified &&
    !actor.level1Qualified
  ) {
    throw new Error("Inspector not qualified");
  }

  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  const createdAt = new Date();
  const existing = await prisma.inspection.findMany({
    where: { assetId },
    select: { folderKey: true },
  });
  const { folderKey, includeTimeInLabel } = allocateInspectionFolderKey(
    createdAt,
    existing.map((e) => e.folderKey),
  );
  const roadName = asset.roadName || "Unknown Road";
  const titleLabel = buildInspectionLabel({
    roadName,
    assetNumber: asset.assetNumber,
    at: createdAt,
    includeTime: includeTimeInLabel,
  });

  ensureDataDirs();

  const requiresLevel2Approval =
    Boolean(typeDef.requiresLevel2Approval) && !actor.level2Qualified;

  const priorInspection = await prisma.inspection.findFirst({
    where: {
      assetId,
      formPayload: { not: null },
      NOT: { status: "DRAFT" },
    },
    orderBy: [{ inspectedAt: "desc" }, { submittedAt: "desc" }],
    select: { formPayload: true },
  });
  // Also allow draft priors that have clearance data if no submitted one
  const priorPayload =
    priorInspection?.formPayload ??
    (
      await prisma.inspection.findFirst({
        where: { assetId, formPayload: { not: null } },
        orderBy: [{ inspectedAt: "desc" }, { submittedAt: "desc" }],
        select: { formPayload: true },
      })
    )?.formPayload ??
    null;

  const inspection = await prisma.inspection.create({
    data: {
      assetId,
      level,
      status: "DRAFT",
      generalComments,
      createdById: actor.id,
      submittedAt: createdAt,
      inspectedAt: createdAt,
      requiresLevel2Approval,
      folderKey,
      titleLabel,
      relationKind: "STANDALONE",
      formPayload: serializeFormPayload(
        seedFormPayloadFromAsset({
          asset,
          template: getTemplateForLevel(level),
          inspectorName: actor.name,
          inspectedAt: createdAt,
          priorFormPayload: priorPayload,
        }),
      ),
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

  const permitRows = ASSET_PERMIT_FLAGS.filter((f) => asset[f.assetField]).map((f) => {
    const willUse = String(formData.get(`permit_${f.key}_willUse`) ?? "") === "1";
    const reason = String(formData.get(`permit_${f.key}_reason`) ?? "").trim();
    if (!willUse && !reason) {
      throw new Error(`Reason required when not using: ${f.label}`);
    }
    return {
      inspectionId: inspection.id,
      permitKey: f.key,
      label: f.label,
      requiredOnAsset: true,
      willUse,
      notNeededReason: willUse ? null : reason,
    };
  });
  if (permitRows.length > 0) {
    await prisma.inspectionPermitCheck.createMany({ data: permitRows });
  }

  revalidatePath("/");
  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  revalidatePath(`/inspections/${inspection.id}`);

  redirect(`/inspections/${inspection.id}`);
}

export async function submitInspection(formData: FormData) {
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const actor = await requireUser();
  const inspection = await prisma.inspection.findUniqueOrThrow({
    where: { id: inspectionId },
    include: { asset: true, createdBy: true },
  });

  if (!canEditInspection(actor, inspection)) {
    throw new Error("You cannot submit this inspection");
  }
  if (inspection.status !== "DRAFT" && inspection.status !== "REJECTED") {
    throw new Error("Only drafts can be submitted");
  }

  const now = new Date();
  const restore = inspection.editRestoreStatus;
  const status =
    restore === "APPROVED" ||
    restore === "SUBMITTED" ||
    restore === "PENDING_APPROVAL"
      ? restore
      : inspection.requiresLevel2Approval
        ? "PENDING_APPROVAL"
        : "SUBMITTED";
  const firstSubmit = inspection.status === "DRAFT" && !restore;

  await prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      status,
      // Preserve original submission and inspection dates on resubmit / re-edit
      ...(firstSubmit ? { submittedAt: now } : {}),
      lastEditedAt: now,
      editRestoreStatus: null,
      editSnapshot: null,
    },
  });

  if (status === "PENDING_APPROVAL" && !restore) {
    const { excludeRootUserWhere } = await import("@/lib/roles");
    const level2Users = await prisma.user.findMany({
      where: { level2Qualified: true, AND: [excludeRootUserWhere] },
    });
    await prisma.notification.createMany({
      data: level2Users.map((u) => ({
        userId: u.id,
        inspectionId: inspection.id,
        title: "Level 2 verification required",
        message: `${inspection.titleLabel} — submitted by ${inspection.createdBy.name}, needs verification.`,
      })),
    });
  }

  revalidatePath("/");
  revalidatePath("/approvals");
  revalidatePath(`/assets/${inspection.assetId}`);
  revalidatePath(`/inspections/${inspectionId}`);
  revalidatePath(`/inspections/${inspectionId}/report`);

  redirect(`/inspections/${inspectionId}/report`);
}

/** Re-open a submitted/approved report for editing without changing submission or inspection dates. */
export async function reopenInspectionForEdit(formData: FormData) {
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const actor = await requireUser();
  const inspection = await prisma.inspection.findUniqueOrThrow({
    where: { id: inspectionId },
  });

  if (actor.role !== "ADMIN" && inspection.createdById !== actor.id) {
    throw new Error("You cannot edit this inspection");
  }
  if (
    inspection.status !== "SUBMITTED" &&
    inspection.status !== "APPROVED" &&
    inspection.status !== "PENDING_APPROVAL"
  ) {
    throw new Error("Only submitted or approved reports need reopen");
  }

  const snapshot = JSON.stringify({
    formPayload: inspection.formPayload ?? null,
    generalComments: inspection.generalComments ?? null,
  });

  await prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      editRestoreStatus: inspection.status,
      editSnapshot: snapshot,
      status: "DRAFT",
      lastEditedAt: new Date(),
      // Keep submittedAt and inspectedAt unchanged
    },
  });

  revalidatePath(`/inspections/${inspectionId}`);
  revalidatePath(`/inspections/${inspectionId}/report`);
  revalidatePath(`/assets/${inspection.assetId}`);
  redirect(`/inspections/${inspectionId}`);
}

/** Discard in-progress re-edit: restore form + prior status (submitted/approved/pending). */
export async function cancelInspectionEdit(formData: FormData) {
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const actor = await requireUser();
  const inspection = await prisma.inspection.findUniqueOrThrow({
    where: { id: inspectionId },
  });

  if (actor.role !== "ADMIN" && inspection.createdById !== actor.id) {
    throw new Error("You cannot cancel edit on this inspection");
  }
  if (!inspection.editRestoreStatus) {
    throw new Error("This inspection is not in a re-edit session");
  }
  if (inspection.status !== "DRAFT" && inspection.status !== "REJECTED") {
    throw new Error("Nothing to cancel");
  }

  let formPayload = inspection.formPayload;
  let generalComments = inspection.generalComments;
  if (inspection.editSnapshot) {
    try {
      const snap = JSON.parse(inspection.editSnapshot) as {
        formPayload?: string | null;
        generalComments?: string | null;
      };
      if ("formPayload" in snap) formPayload = snap.formPayload ?? null;
      if ("generalComments" in snap) {
        generalComments = snap.generalComments ?? null;
      }
    } catch {
      /* keep current form if snapshot corrupt */
    }
  }

  const restore = inspection.editRestoreStatus;
  if (
    restore !== "SUBMITTED" &&
    restore !== "APPROVED" &&
    restore !== "PENDING_APPROVAL"
  ) {
    throw new Error("Invalid restore status");
  }

  await prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      status: restore,
      formPayload,
      generalComments,
      editRestoreStatus: null,
      editSnapshot: null,
    },
  });

  revalidatePath(`/inspections/${inspectionId}`);
  revalidatePath(`/inspections/${inspectionId}/report`);
  revalidatePath(`/assets/${inspection.assetId}`);
  redirect(`/inspections/${inspectionId}/report`);
}

export async function updateGeneralComments(formData: FormData) {
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const generalComments = String(formData.get("generalComments") ?? "") || null;
  const actor = await requireUser();
  const inspection = await prisma.inspection.findUniqueOrThrow({
    where: { id: inspectionId },
  });
  if (!canEditInspection(actor, inspection)) {
    throw new Error("Cannot edit this inspection");
  }
  await prisma.inspection.update({
    where: { id: inspectionId },
    data: { generalComments },
  });
  revalidatePath(`/inspections/${inspectionId}`);
}

export async function updateCategoryComment(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const comments = String(formData.get("comments") ?? "");
  const actor = await requireUser();
  const existing = await prisma.inspectionCategory.findUniqueOrThrow({
    where: { id },
    include: { inspection: true },
  });
  if (!canEditInspection(actor, existing.inspection)) {
    throw new Error("Cannot edit this inspection");
  }
  const row = await prisma.inspectionCategory.update({
    where: { id },
    data: { comments },
  });
  revalidatePath(`/inspections/${row.inspectionId}`);
}

export async function addInspectionCategory(formData: FormData) {
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const category = String(formData.get("category") ?? "").trim();
  const subcategory = String(formData.get("subcategory") ?? "").trim();
  const actor = await requireUser();

  if (!inspectionId || !category || !subcategory) {
    throw new Error("Category and subcategory required");
  }

  const inspection = await prisma.inspection.findUniqueOrThrow({
    where: { id: inspectionId },
  });
  if (!canEditInspection(actor, inspection)) {
    throw new Error("Cannot edit this inspection");
  }

  await prisma.inspectionCategory.create({
    data: { inspectionId, category, subcategory, comments: null },
  });
  revalidatePath(`/inspections/${inspectionId}`);
}

export async function removeInspectionCategory(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const actor = await requireUser();
  const row = await prisma.inspectionCategory.findUniqueOrThrow({
    where: { id },
    include: { inspection: true },
  });
  if (!canEditInspection(actor, row.inspection)) {
    throw new Error("Cannot edit this inspection");
  }
  await prisma.inspectionCategory.delete({ where: { id } });
  revalidatePath(`/inspections/${row.inspectionId}`);
}

export async function addDefect(formData: FormData) {
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const comments = String(formData.get("comments") ?? "") || null;
  const category = String(formData.get("category") ?? "") || null;
  const subcategory = String(formData.get("subcategory") ?? "") || null;
  const severity = String(formData.get("severity") ?? "MEDIUM").trim() || "MEDIUM";
  const photo = formData.get("photo");
  const actor = await requireUser();

  if (!inspectionId || !description) {
    throw new Error("Inspection and description required");
  }

  if (!(photo instanceof Blob) || photo.size === 0) {
    throw new Error("Defect photo is required");
  }

  const inspection = await prisma.inspection.findUniqueOrThrow({
    where: { id: inspectionId },
    include: { asset: true, defects: true },
  });
  if (!canEditInspection(actor, inspection)) {
    throw new Error("Cannot edit this inspection");
  }

  const defectCode = nextDefectCode(
    inspection.asset.assetNumber,
    inspection.defects.map((d) => d.defectCode),
  );

  const buffer = Buffer.from(await photo.arrayBuffer());
  const originalName = photo instanceof File ? photo.name : null;
  const { relativePath, takenAt } = await saveCompressedDefectPhoto({
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

  revalidatePath(`/inspections/${inspectionId}`);
}

/** Bring a prior defect into the current draft; old photo becomes comparison. */
export async function carryForwardDefect(formData: FormData) {
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const sourceDefectId = String(formData.get("sourceDefectId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const comments = String(formData.get("comments") ?? "") || null;
  const severity = String(formData.get("severity") ?? "MEDIUM").trim() || "MEDIUM";
  const photo = formData.get("photo");
  const actor = await requireUser();

  if (!inspectionId || !sourceDefectId) {
    throw new Error("Inspection and source defect required");
  }

  const inspection = await prisma.inspection.findUniqueOrThrow({
    where: { id: inspectionId },
    include: { asset: true, defects: true },
  });
  if (!canEditInspection(actor, inspection)) {
    throw new Error("Cannot edit this inspection");
  }

  const source = await prisma.defect.findUniqueOrThrow({
    where: { id: sourceDefectId },
    include: { inspection: true },
  });
  if (source.inspection.assetId !== inspection.assetId) {
    throw new Error("Source defect must be on the same asset");
  }

  const defectCode = nextDefectCode(
    inspection.asset.assetNumber,
    inspection.defects.map((d) => d.defectCode),
  );

  let photoPath: string | null = null;
  let photoTakenAt: Date | null = null;
  if (photo instanceof Blob && photo.size > 0) {
    const buffer = Buffer.from(await photo.arrayBuffer());
    const saved = await saveCompressedDefectPhoto({
      buffer,
      roadName: inspection.asset.roadName || "Unknown Road",
      assetNumber: inspection.asset.assetNumber,
      folderKey: inspection.folderKey,
      defectCode,
      originalName: photo instanceof File ? photo.name : null,
      fileLastModifiedMs:
        photo instanceof File && Number.isFinite(photo.lastModified)
          ? photo.lastModified
          : null,
    });
    photoPath = saved.relativePath;
    photoTakenAt = saved.takenAt;
  }

  await prisma.defect.create({
    data: {
      inspectionId,
      defectCode,
      description: description || source.description,
      comments: comments ?? source.comments,
      category: source.category,
      subcategory: source.subcategory,
      componentId: source.componentId,
      severity,
      photoPath,
      comparisonPhotoPath: source.photoPath,
      carriedFromDefectId: source.id,
      ...(photoPath && photoTakenAt
        ? {
            photos: {
              create: {
                path: photoPath,
                kind: "overview",
                sortOrder: 0,
                takenAt: photoTakenAt,
              },
            },
          }
        : {}),
    },
  });

  revalidatePath(`/inspections/${inspectionId}`);
}

export async function saveSeverities(formData: FormData) {
  await requireAdmin();
  const raw = String(formData.get("severitiesJson") ?? "[]");
  let parsed: { value: string; label: string; description?: string }[] = [];
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("Invalid severities JSON");
  }
  saveSeverityOptions(parsed);
  revalidatePath("/manage/severities");
}

export async function saveInspectionTypesAction(formData: FormData) {
  await requireAdmin();
  const raw = String(formData.get("typesJson") ?? "[]");
  let parsed: {
    value: string;
    label: string;
    description: string;
    requiresLevel2Approval?: boolean;
    intervalYears?: number;
  }[] = [];
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("Invalid inspection types JSON");
  }
  const cleaned = saveInspectionTypes(parsed);

  // Retroactive: keep asset L1/L2 interval fields in sync with type catalogue
  const l1 = cleaned.find((t) => t.value === "LEVEL_1");
  const l2 = cleaned.find((t) => t.value === "LEVEL_2");
  let syncedAssets = 0;
  if (l1 || l2) {
    const data: {
      level1IntervalYears?: number;
      level2IntervalYears?: number;
    } = {};
    if (l1 && (l1.intervalYears ?? 0) > 0) {
      data.level1IntervalYears = l1.intervalYears;
    }
    if (l2 && (l2.intervalYears ?? 0) > 0) {
      data.level2IntervalYears = l2.intervalYears;
    }
    if (Object.keys(data).length > 0) {
      const result = await prisma.asset.updateMany({ data });
      syncedAssets = result.count;
    }
  }

  revalidatePath("/manage/inspection-types");
  revalidatePath("/inspect");
  revalidatePath("/manage");
  revalidatePath("/assets");
  revalidatePath("/");
  return { ok: true as const, syncedAssets };
}

export async function saveInspectionTemplateAction(formData: FormData) {
  await requireAdmin();
  const raw = String(formData.get("templateJson") ?? "");
  let parsed: InspectionTemplate;
  try {
    parsed = JSON.parse(raw) as InspectionTemplate;
  } catch {
    throw new Error("Invalid template JSON");
  }
  const all = getInspectionTemplates();
  all[parsed.typeCode] = parsed;
  saveInspectionTemplates(all);
  revalidatePath("/manage/inspection-templates");
  revalidatePath(`/manage/inspection-templates/${parsed.typeCode}`);
  revalidatePath("/inspections");
}

export async function resetInspectionTemplateAction(formData: FormData) {
  await requireAdmin();
  const typeCode = String(formData.get("typeCode") ?? "").trim();
  if (!typeCode) throw new Error("Type code required");
  resetTemplateToSeed(typeCode);
  revalidatePath("/manage/inspection-templates");
  revalidatePath(`/manage/inspection-templates/${typeCode}`);
}

export async function deleteDraftInspection(formData: FormData) {
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const actor = await requireUser();
  if (!inspectionId) throw new Error("Inspection required");

  const inspection = await prisma.inspection.findUniqueOrThrow({
    where: { id: inspectionId },
  });

  if (inspection.status !== "DRAFT") {
    throw new Error("Only drafts can be deleted");
  }
  if (inspection.createdById !== actor.id && actor.role !== "ADMIN") {
    throw new Error("You can only delete your own drafts");
  }

  const assetId = inspection.assetId;
  await prisma.inspection.update({
    where: { id: inspectionId },
    data: { deletedAt: new Date(), deletedById: actor.id },
  });

  revalidatePath("/");
  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/approvals");
  revalidatePath("/manage/trash");

  const next = String(formData.get("next") ?? "").trim();
  if (next.startsWith("/")) redirect(next);
  redirect("/");
}

/**
 * Admin soft-delete — moves report to Trash (30-day retention).
 * Requires the admin's login password in `password`.
 * Returns next URL for client navigation (avoids NEXT_REDIRECT being caught as an error).
 */
export async function adminDeleteInspectionAction(formData: FormData): Promise<{
  ok: true;
  next: string;
}> {
  const admin = await requireAdmin();
  const inspectionId = String(formData.get("inspectionId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmText = String(formData.get("confirmText") ?? "").trim();
  if (!inspectionId) throw new Error("Inspection required");
  if (!password) throw new Error("Password required");

  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
  if (!dbUser.passwordHash || !verifyPassword(password, dbUser.passwordHash)) {
    throw new Error("Incorrect password");
  }

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
  });
  if (!inspection) throw new Error("Inspection not found");
  if (inspection.deletedAt) throw new Error("Report is already in Trash");

  if (confirmText !== inspection.titleLabel && confirmText !== "DELETE") {
    throw new Error(
      `Type DELETE or the exact report title to confirm (“${inspection.titleLabel}”)`,
    );
  }

  const assetId = inspection.assetId;
  await prisma.inspection.update({
    where: { id: inspectionId },
    data: { deletedAt: new Date(), deletedById: admin.id },
  });

  revalidatePath("/");
  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  revalidatePath(`/manage/assets/${assetId}`);
  revalidatePath("/approvals");
  revalidatePath("/manage");
  revalidatePath("/manage/trash");
  revalidatePath("/manage/reports");

  const nextRaw = String(formData.get("next") ?? "").trim();
  const next = nextRaw.startsWith("/") ? nextRaw : `/manage/assets/${assetId}`;
  return { ok: true, next };
}

export async function approveInspection(formData: FormData) {
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const approver = await requireUser();

  if (!canApproveLevel2(approver)) {
    throw new Error("Only Level 2 qualified inspectors (or admins) can approve");
  }

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
  });
  if (!inspection) throw new Error("Inspection not found");
  if (inspection.status !== "PENDING_APPROVAL") {
    throw new Error("Inspection is not waiting for approval");
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
  revalidatePath(`/inspections/${inspectionId}/report`);
  revalidatePath("/");
}

export async function rejectInspection(formData: FormData) {
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const actor = await requireUser();

  if (!canApproveLevel2(actor)) {
    throw new Error("Only Level 2 qualified inspectors (or admins) can send back");
  }

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
  });
  if (!inspection) throw new Error("Inspection not found");
  if (inspection.status !== "PENDING_APPROVAL") {
    throw new Error("Inspection is not waiting for approval");
  }

  await prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      status: "REJECTED",
      // Do not stamp rejector as approver on the report
      approvedById: null,
      approvedAt: null,
    },
  });

  revalidatePath("/approvals");
  revalidatePath(`/inspections/${inspectionId}`);
  revalidatePath(`/inspections/${inspectionId}/report`);
}

export async function requestSecondReviewAction(formData: FormData) {
  const actor = await requireUser();
  const inspectionId = String(formData.get("inspectionId") ?? "").trim();
  const reviewerId = String(formData.get("reviewerId") ?? "").trim();
  const reviewNote = String(formData.get("reviewNote") ?? "").trim() || null;
  if (!inspectionId || !reviewerId) throw new Error("Inspection and reviewer required");

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { createdBy: true },
  });
  if (!inspection) throw new Error("Inspection not found");
  if (inspection.createdById !== actor.id && actor.role !== "ADMIN") {
    throw new Error("Only the submitting inspector can request a second review");
  }
  if (
    inspection.status !== "SUBMITTED" &&
    inspection.status !== "APPROVED" &&
    inspection.status !== "PENDING_APPROVAL"
  ) {
    throw new Error("Submit the inspection before requesting a second review");
  }
  if (reviewerId === inspection.createdById) {
    throw new Error("Choose a different person — not yourself");
  }

  const reviewer = await prisma.user.findUnique({ where: { id: reviewerId } });
  if (!reviewer) throw new Error("Reviewer not found");

  await prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      reviewStatus: "REQUESTED",
      reviewRequestedFromId: reviewerId,
      reviewedById: null,
      reviewedAt: null,
      reviewNote,
    },
  });

  await prisma.notification.create({
    data: {
      userId: reviewerId,
      inspectionId,
      title: "Second review requested",
      message: `${inspection.titleLabel} — ${inspection.createdBy.name} asked you for a second look.${reviewNote ? ` Note: ${reviewNote}` : ""}`,
    },
  });

  revalidatePath(`/inspections/${inspectionId}`);
  revalidatePath(`/inspections/${inspectionId}/report`);
  revalidatePath("/approvals");
}

export async function completeSecondReviewAction(formData: FormData) {
  const actor = await requireUser();
  const inspectionId = String(formData.get("inspectionId") ?? "").trim();
  if (!inspectionId) throw new Error("Inspection required");

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
  });
  if (!inspection) throw new Error("Inspection not found");
  if (inspection.reviewStatus !== "REQUESTED") {
    throw new Error("No second review is pending");
  }
  // Looking at it while logged in as the original inspector must not stamp a name
  if (actor.id === inspection.createdById) {
    throw new Error(
      "You cannot mark this as reviewed while logged in as the original inspector",
    );
  }
  if (
    inspection.reviewRequestedFromId &&
    inspection.reviewRequestedFromId !== actor.id &&
    actor.role !== "ADMIN"
  ) {
    throw new Error("This review was requested from someone else");
  }

  await prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      reviewStatus: "COMPLETED",
      reviewedById: actor.id,
      reviewedAt: new Date(),
    },
  });

  await prisma.notification.updateMany({
    where: {
      inspectionId,
      userId: actor.id,
      read: false,
      title: "Second review requested",
    },
    data: { read: true },
  });

  revalidatePath(`/inspections/${inspectionId}`);
  revalidatePath(`/inspections/${inspectionId}/report`);
  revalidatePath("/approvals");
}

/** Cancel / “don’t worry about it” — no reviewed-by line on the report. */
export async function skipSecondReviewAction(formData: FormData) {
  const actor = await requireUser();
  const inspectionId = String(formData.get("inspectionId") ?? "").trim();
  if (!inspectionId) throw new Error("Inspection required");

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
  });
  if (!inspection) throw new Error("Inspection not found");
  if (inspection.reviewStatus !== "REQUESTED") {
    throw new Error("No second review is pending to skip");
  }
  if (inspection.createdById !== actor.id && actor.role !== "ADMIN") {
    throw new Error("Only the submitting inspector can skip the second review");
  }

  await prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      reviewStatus: "SKIPPED",
      reviewedById: null,
      reviewedAt: null,
      reviewRequestedFromId: null,
      reviewNote: null,
    },
  });

  revalidatePath(`/inspections/${inspectionId}`);
  revalidatePath(`/inspections/${inspectionId}/report`);
  revalidatePath("/approvals");
}

export async function createUser(formData: FormData) {
  await requireAdmin();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const nameFromParts = [firstName, lastName].filter(Boolean).join(" ");
  const name =
    nameFromParts || String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const username =
    String(formData.get("username") ?? "").trim().toLowerCase() || null;
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "INSPECTOR") as "ADMIN" | "INSPECTOR";
  const level1Qualified = formData.get("level1Qualified") === "on";
  const level2Qualified = formData.get("level2Qualified") === "on";
  const registrationNumber =
    String(formData.get("registrationNumber") ?? "").trim() || null;

  if (!firstName || !lastName) {
    throw new Error("First and last name are required");
  }
  if (!name || !email) throw new Error("Name and email required");
  if (!password) throw new Error("Password required");
  const { isRootUsername } = await import("@/lib/roles");
  if (isRootUsername(username) || email === "root@veninspect.local") {
    throw new Error("The root username is reserved for the system admin account");
  }
  const passwordError = validateNewPassword(password);
  if (passwordError) throw new Error(passwordError);

  await prisma.user.create({
    data: {
      name,
      firstName,
      lastName,
      email,
      username,
      role,
      level1Qualified,
      level2Qualified,
      registrationNumber,
      allowPasswordLogin: true,
      allowMicrosoftLogin: false,
      passwordHash: hashPassword(password),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/manage/users");
}

export async function updateUserQualifications(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const usernameRaw = String(formData.get("username") ?? "").trim().toLowerCase();
  const username = usernameRaw || null;
  const role = String(formData.get("role") ?? "INSPECTOR") as "ADMIN" | "INSPECTOR";
  const level1Qualified = formData.get("level1Qualified") === "on";
  const level2Qualified = formData.get("level2Qualified") === "on";
  const password = String(formData.get("password") ?? "");
  const registrationNumber =
    String(formData.get("registrationNumber") ?? "").trim() || null;

  if (!id) throw new Error("User id required");
  if (!firstName || !lastName) throw new Error("First and last name are required");
  if (!email) throw new Error("Email required");

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new Error("User not found");

  const { isRootUsername } = await import("@/lib/roles");
  const targetIsRoot = isRootUsername(existing.username);
  if (targetIsRoot) {
    if (password) {
      throw new Error(
        "Root password cannot be changed in the app. Update it on the server.",
      );
    }
    if (username !== "root") {
      throw new Error("The root username cannot be changed");
    }
    if (role !== "ADMIN") {
      throw new Error("The root account must remain Admin");
    }
  } else if (isRootUsername(username) || email === "root@veninspect.local") {
    throw new Error("The root username is reserved for the system admin account");
  }

  const name = `${firstName} ${lastName}`.trim();

  await prisma.user.update({
    where: { id },
    data: {
      firstName,
      lastName,
      name,
      email: targetIsRoot ? existing.email : email,
      username: targetIsRoot ? "root" : username,
      role: targetIsRoot ? "ADMIN" : role,
      level1Qualified,
      level2Qualified,
      registrationNumber,
      allowPasswordLogin: true,
      ...(password && !targetIsRoot
        ? (() => {
            const err = validateNewPassword(password);
            if (err) throw new Error(err);
            return { passwordHash: hashPassword(password) };
          })()
        : {}),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/manage/users");
}

/**
 * Asset registry import (server action).
 * Manage layout already requires admin — do not re-check role here.
 * Only require the short grant minted when the Import page rendered.
 */
export async function importAssetsFromFile(formData: FormData): Promise<
  | { ok: true; created: number; updated: number; skipped: number; total: number; errors: string[] }
  | { ok: false; error: string }
> {
  try {
    const { verifyAssetImportGrant } = await import("@/lib/import-grant");

    const grantId = String(formData.get("importGrant") ?? "").trim();
    if (!verifyAssetImportGrant(grantId)) {
      return {
        ok: false,
        error:
          "Import session expired. Open Manage → Assets → Import again, then retry the upload.",
      };
    }

    const file = formData.get("file");
    const mode = String(formData.get("mode") ?? "upsert");

    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose an Excel (.xlsx) or CSV file" };
    }
    if (file.size > 40 * 1024 * 1024) {
      return {
        ok: false,
        error: "File too large (max 40 MB). Split the workbook or use CSV.",
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { runAssetImport } = await import("@/lib/asset-import-run");
    const result = await runAssetImport(buffer, mode);
    return { ok: true, ...result };
  } catch (e) {
    if (
      typeof e === "object" &&
      e &&
      "digest" in e &&
      String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw e;
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Import failed",
    };
  }
}

export async function upsertAssetManual(formData: FormData) {
  await requireAdmin();
  const assetNumber = String(formData.get("assetNumber") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const type =
    String(formData.get("type") ?? "BRIDGE")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_") || "BRIDGE";
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

export async function updateAssetDetails(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Asset id required");

  const assetNumber = String(formData.get("assetNumber") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const type =
    String(formData.get("type") ?? "BRIDGE")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_") || "BRIDGE";
  const assetVisionId = String(formData.get("assetVisionId") ?? "").trim() || null;
  const roadName = String(formData.get("roadName") ?? "").trim() || "Unknown Road";
  const location = String(formData.get("location") ?? "").trim() || null;
  const classification = String(formData.get("classification") ?? "").trim() || null;
  const subClassification =
    String(formData.get("subClassification") ?? "").trim().toUpperCase().replace(/\s+/g, "_") ||
    null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const latitudeRaw = String(formData.get("latitude") ?? "").trim();
  const longitudeRaw = String(formData.get("longitude") ?? "").trim();
  const latitude = latitudeRaw ? Number(latitudeRaw) : null;
  const longitude = longitudeRaw ? Number(longitudeRaw) : null;
  const chainageFromRaw = String(formData.get("chainageFrom") ?? "").trim();
  const chainageToRaw = String(formData.get("chainageTo") ?? "").trim();
  const chainageFrom = chainageFromRaw ? Number(chainageFromRaw) : null;
  const chainageTo = chainageToRaw ? Number(chainageToRaw) : null;
  const l1Default = inspectionTypeIntervalYears("LEVEL_1") || 3;
  const l2Default = inspectionTypeIntervalYears("LEVEL_2") || 5;
  const l1 = Number(String(formData.get("level1IntervalYears") ?? String(l1Default)));
  const l2 = Number(String(formData.get("level2IntervalYears") ?? String(l2Default)));

  function parseOptionalDate(raw: string): Date | null {
    const s = raw.trim();
    if (!s) return null;
    // date input → YYYY-MM-DD (treat as local noon to avoid TZ day-shift)
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const lastLevel1At = parseOptionalDate(
    String(formData.get("lastLevel1At") ?? ""),
  );
  const lastLevel2At = parseOptionalDate(
    String(formData.get("lastLevel2At") ?? ""),
  );

  if (!assetNumber || !name) throw new Error("Code and name required");

  const before = await prisma.asset.findUnique({ where: { id } });
  if (before) {
    const actor = await requireAdmin();
    await prisma.assetAttributeSnapshot.create({
      data: {
        assetId: id,
        kind: "details",
        payload: JSON.stringify({
          assetNumber: before.assetNumber,
          name: before.name,
          notes: before.notes,
          type: before.type,
          roadName: before.roadName,
        }),
        actorId: actor.id,
      },
    });
  }

  await prisma.asset.update({
    where: { id },
    data: {
      assetNumber,
      name,
      type,
      assetVisionId,
      roadName,
      location,
      classification,
      subClassification,
      notes,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      chainageFrom: Number.isFinite(chainageFrom) ? chainageFrom : null,
      chainageTo: Number.isFinite(chainageTo) ? chainageTo : null,
      parentChainage: Number.isFinite(chainageFrom) ? chainageFrom : null,
      level1IntervalYears: Number.isFinite(l1) && l1 > 0 ? l1 : l1Default,
      level2IntervalYears: Number.isFinite(l2) && l2 > 0 ? l2 : l2Default,
      lastLevel1At,
      lastLevel2At,
      requireConfinedSpace: formData.get("requireConfinedSpace") === "on",
      requireTrafficManagement: formData.get("requireTrafficManagement") === "on",
      requireWorkingAtHeights: formData.get("requireWorkingAtHeights") === "on",
    },
  });

  revalidatePath("/manage/assets");
  revalidatePath(`/manage/assets/${id}`);
  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  revalidatePath("/map");
  redirect(`/manage/assets/${id}?tab=details&saved=1`);
}

export async function savePhotoStoragePath(formData: FormData) {
  await requireAdmin();
  const photoDir = String(formData.get("photoDir") ?? "").trim();
  const returnRaw = String(formData.get("returnTo") ?? "").trim();
  const returnBase =
    returnRaw.startsWith("/manage/") && !returnRaw.includes("..")
      ? returnRaw.split("?")[0]!
      : "/manage/storage";

  const finish = (query: string): never => {
    revalidatePath("/manage/storage");
    revalidatePath("/manage/system");
    redirect(`${returnBase}?${query}`);
  };

  if (process.env.PHOTO_DIR?.trim()) {
    finish(
      `photoError=${encodeURIComponent(
        "PHOTO_DIR is set in /etc/veninspect.env and locks the UI. Change or remove it there, then restart veninspect.",
      )}`,
    );
  }

  if (photoDir) {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const resolved = path.resolve(photoDir);
    try {
      fs.mkdirSync(resolved, { recursive: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      finish(
        `photoError=${encodeURIComponent(
          `Could not create folder ${resolved}: ${msg}`,
        )}`,
      );
    }
    try {
      const probe = path.join(resolved, ".veninspect-write-test");
      fs.writeFileSync(probe, "ok");
      fs.unlinkSync(probe);
    } catch {
      finish(
        `photoError=${encodeURIComponent(
          `Photo path is not writable by the app user: ${resolved}. On the host/CT: ensure the bind mount is up and writable (CIFS uid/gid or chown for veninspect).`,
        )}`,
      );
    }
    try {
      writeStorageSettings({ photoDir: resolved });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      finish(
        `photoError=${encodeURIComponent(`Could not write settings: ${msg}`)}`,
      );
    }
  } else {
    try {
      writeStorageSettings({ photoDir: undefined });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      finish(
        `photoError=${encodeURIComponent(`Could not write settings: ${msg}`)}`,
      );
    }
  }

  try {
    ensureDataDirs();
  } catch {
    /* settings saved; odd mounts may reject mkdir — uploads will report clearly */
  }

  finish("photoSaved=1");
}

export async function saveGoogleMapsApiKey(formData: FormData) {
  await requireAdmin();
  const providerRaw = String(formData.get("mapProvider") ?? "osm").trim();
  const provider =
    providerRaw === "google" || providerRaw === "nearmap" || providerRaw === "osm"
      ? providerRaw
      : "osm";
  const googleKey = String(formData.get("googleMapsApiKey") ?? "").trim();
  const nearmapKey = String(formData.get("nearmapApiKey") ?? "").trim();

  const googleLocked = Boolean(
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim(),
  );
  const nearmapLocked = Boolean(process.env.NEARMAP_API_KEY?.trim());

  // Prefilled fields always submit the current value; empty clears settings keys.
  writeStorageSettings({
    mapProvider: provider,
    ...(!googleLocked ? { googleMapsApiKey: googleKey || undefined } : {}),
    ...(!nearmapLocked ? { nearmapApiKey: nearmapKey || undefined } : {}),
  });
  revalidatePath("/manage/system");
  revalidatePath("/map");
  redirect("/manage/system");
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

export async function saveAssetTypesAction(formData: FormData) {
  await requireAdmin();
  const raw = String(formData.get("typesJson") ?? "[]");
  let parsed: { value: string; label: string; description?: string }[] = [];
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("Invalid asset types JSON");
  }
  saveAssetTypes(parsed);
  revalidatePath("/manage");
  revalidatePath("/manage/asset-types");
  revalidatePath("/manage/assets");
}

export async function saveAssetProfileAction(formData: FormData) {
  await requireAdmin();
  const assetId = String(formData.get("assetId") ?? "");
  if (!assetId) throw new Error("Asset required");
  let values: Record<string, string> = {};
  let autoPopulate: Record<string, boolean> = {};
  try {
    values = JSON.parse(String(formData.get("valuesJson") ?? "{}")) as Record<
      string,
      string
    >;
    autoPopulate = JSON.parse(
      String(formData.get("autoPopulateJson") ?? "{}"),
    ) as Record<string, boolean>;
  } catch {
    throw new Error("Invalid profile JSON");
  }
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  const existing = parseAssetProfile(asset.profileJson);
  await prisma.asset.update({
    where: { id: assetId },
    data: {
      profileJson: serializeAssetProfile({
        values,
        autoPopulate,
        importedAt: existing.importedAt,
        sourceFile: existing.sourceFile,
      }),
    },
  });
  revalidatePath(`/manage/assets/${assetId}`);
  revalidatePath(`/assets/${assetId}`);
}

export async function saveExportConfigAction(formData: FormData) {
  await requireAdmin();
  const raw = String(formData.get("configJson") ?? "{}");
  let parsed: import("@/lib/export-config").ExportConfig;
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("Invalid export config JSON");
  }
  const { saveExportConfig } = await import("@/lib/export-config");
  saveExportConfig(parsed);
  revalidatePath("/manage");
  revalidatePath("/manage/export-config");
}

export async function saveDocumentTagsAction(formData: FormData) {
  await requireAdmin();
  const raw = String(formData.get("tagsJson") ?? "[]");
  let parsed: { value: string; label: string }[] = [];
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("Invalid document tags JSON");
  }
  saveDocumentTags(parsed);
  revalidatePath("/manage");
  revalidatePath("/manage/document-tags");
}

export async function saveAssetComponentsAction(formData: FormData) {
  await requireAdmin();
  const assetId = String(formData.get("assetId") ?? "");
  const raw = String(formData.get("componentsJson") ?? "[]");
  if (!assetId) throw new Error("Asset required");
  let parsed: AssetComponent[] = [];
  try {
    parsed = JSON.parse(raw) as AssetComponent[];
  } catch {
    throw new Error("Invalid components JSON");
  }
  const cleaned = parsed
    .map((c, i) => ({
      id: c.id?.trim() || newComponentId(),
      name: String(c.name ?? "").trim(),
      category: c.category ? String(c.category) : undefined,
      qty: c.qty != null ? String(c.qty) : undefined,
      unit: c.unit ? String(c.unit) : undefined,
      sortOrder: i,
    }))
    .filter((c) => c.name);
  await prisma.asset.update({
    where: { id: assetId },
    data: { componentsJson: serializeAssetComponents(cleaned) },
  });
  revalidatePath(`/manage/assets/${assetId}`);
  revalidatePath(`/assets/${assetId}`);
}

/** Field inspector: append a component to the asset register while editing a draft. */
export async function addAssetComponentFromInspectionAction(formData: FormData) {
  const user = await requireUser();
  const inspectionId = String(formData.get("inspectionId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || undefined;
  const qty = String(formData.get("qty") ?? "").trim() || undefined;
  const unit = String(formData.get("unit") ?? "").trim() || undefined;
  if (!inspectionId) throw new Error("Inspection required");
  if (!name) throw new Error("Component name required");

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { asset: true },
  });
  if (!inspection) throw new Error("Inspection not found");
  if (!canEditInspection(user, inspection)) {
    throw new Error("Cannot edit this inspection");
  }

  const existing = parseAssetComponents(inspection.asset.componentsJson);
  const id = newComponentId();
  const next = [
    ...existing,
    {
      id,
      name,
      category,
      qty,
      unit,
      sortOrder: existing.length,
    },
  ];
  await prisma.asset.update({
    where: { id: inspection.assetId },
    data: { componentsJson: serializeAssetComponents(next) },
  });
  revalidatePath(`/inspections/${inspectionId}`);
  revalidatePath(`/manage/assets/${inspection.assetId}`);
  revalidatePath(`/assets/${inspection.assetId}`);
  return { id, name, category: category ?? "", qty: qty ?? "", unit: unit ?? "" };
}

export async function importAssetAuditExportAction(formData: FormData) {
  await requireAdmin();
  const assetId = String(formData.get("assetId") ?? "");
  const file = formData.get("file");
  const allowClears = String(formData.get("allowClears") ?? "") === "1";
  if (!assetId) throw new Error("Asset required");
  if (!(file instanceof Blob) || file.size === 0) {
    throw new Error("Audit Export file required");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const { values } = parseAssetAuditExport(buffer);
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  const existing = parseAssetProfile(asset.profileJson);
  const merged = { ...existing.values };
  const autoPopulate = { ...(existing.autoPopulate ?? {}) };
  for (const [k, v] of Object.entries(values)) {
    if (!v && !allowClears) continue;
    merged[k] = v;
    // Newly imported fields default to auto-fill so reports pick them up
    if (autoPopulate[k] === undefined) autoPopulate[k] = true;
  }
  const sync = profileSyncHints(merged);
  const originalName = file instanceof File ? file.name : "audit-export.xlsx";
  await prisma.asset.update({
    where: { id: assetId },
    data: {
      profileJson: serializeAssetProfile({
        values: merged,
        autoPopulate,
        importedAt: new Date().toISOString(),
        sourceFile: originalName,
      }),
      ...(sync.latitude != null ? { latitude: sync.latitude } : {}),
      ...(sync.longitude != null ? { longitude: sync.longitude } : {}),
      ...(sync.notes ? { notes: sync.notes } : {}),
      ...(sync.lastLevel2At ? { lastLevel2At: sync.lastLevel2At } : {}),
    },
  });
  revalidatePath(`/manage/assets/${assetId}`);
  revalidatePath(`/assets/${assetId}`);
}

export async function uploadAssetDocumentAction(formData: FormData) {
  const actor = await requireUser();
  const assetId = String(formData.get("assetId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const tagsRaw = String(formData.get("tagsJson") ?? "[]");
  const documentDateRaw = String(formData.get("documentDate") ?? "").trim();
  const setBaseline = String(formData.get("setBaseline") ?? "");
  const file = formData.get("file");
  if (!assetId || !title) throw new Error("Asset and title required");
  if (!(file instanceof Blob) || file.size === 0) {
    throw new Error("File required");
  }
  let tags: string[] = [];
  try {
    tags = (JSON.parse(tagsRaw) as unknown[]).map(String);
  } catch {
    tags = [];
  }
  const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });
  const documentId = `doc_${Date.now().toString(36)}`;
  const originalFilename =
    file instanceof File ? file.name : "document.pdf";
  const buffer = Buffer.from(await file.arrayBuffer());
  const { relativePath } = await saveAssetDocumentFile({
    buffer,
    roadName: asset.roadName,
    assetNumber: asset.assetNumber,
    documentId,
    originalFilename,
  });
  let documentDate: Date | null = null;
  if (documentDateRaw) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(documentDateRaw);
    if (m) {
      documentDate = new Date(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        12,
        0,
        0,
      );
    }
  }
  await prisma.assetDocument.create({
    data: {
      assetId,
      title,
      originalFilename,
      storagePath: relativePath,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: buffer.byteLength,
      tagsJson: JSON.stringify(tags),
      documentDate,
      notes,
      uploadedById: actor.id,
      updatedAt: new Date(),
    },
  });
  if (documentDate && setBaseline === "LEVEL_1") {
    await prisma.asset.update({
      where: { id: assetId },
      data: { lastLevel1At: documentDate },
    });
  }
  if (documentDate && setBaseline === "LEVEL_2") {
    await prisma.asset.update({
      where: { id: assetId },
      data: { lastLevel2At: documentDate },
    });
  }
  revalidatePath(`/assets/${assetId}`);
  revalidatePath(`/manage/assets/${assetId}`);
}

export async function deleteAssetDocumentAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Document id required");
  const doc = await prisma.assetDocument.delete({ where: { id } });
  revalidatePath(`/assets/${doc.assetId}`);
  revalidatePath(`/manage/assets/${doc.assetId}`);
}

async function assertAssignableUserId(userId: string | null) {
  if (!userId) return;
  const assignee = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  const { isRootUsername } = await import("@/lib/roles");
  if (isRootUsername(assignee?.username)) {
    throw new Error("Cannot assign work to the root system account");
  }
}

export async function createAuditAssignmentAction(formData: FormData) {
  await requireAdmin();
  const actor = await requireUser();
  const assetId = String(formData.get("assetId") ?? "");
  const level = String(formData.get("level") ?? "LEVEL_1")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  const dueDateRaw = String(formData.get("dueDate") ?? "");
  const assignedToId = String(formData.get("assignedToId") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!assetId || !dueDateRaw) throw new Error("Asset and due date required");
  await assertAssignableUserId(assignedToId);
  const dueDate = new Date(dueDateRaw + "T12:00:00");
  await prisma.auditAssignment.create({
    data: {
      assetId,
      level,
      dueDate,
      assignedToId,
      createdById: actor.id,
      notes,
      status: assignedToId ? "ASSIGNED" : "PLANNED",
      updatedAt: new Date(),
    },
  });
  if (assignedToId) {
    await prisma.notification.create({
      data: {
        userId: assignedToId,
        title: "Audit assigned",
        message: `You have been assigned a ${level} audit due ${dueDateRaw}.`,
      },
    });
  }
  revalidatePath("/manage/schedule");
  revalidatePath("/");
}

export async function updateAuditAssignmentAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  const assignedToId = String(formData.get("assignedToId") ?? "").trim() || null;
  const dueDateRaw = String(formData.get("dueDate") ?? "").trim();
  if (!id) throw new Error("Assignment id required");
  await assertAssignableUserId(assignedToId);
  await prisma.auditAssignment.update({
    where: { id },
    data: {
      ...(status
        ? {
            status: status as
              | "PLANNED"
              | "ASSIGNED"
              | "IN_PROGRESS"
              | "DONE"
              | "CANCELLED",
          }
        : {}),
      assignedToId,
      ...(dueDateRaw ? { dueDate: new Date(dueDateRaw + "T12:00:00") } : {}),
      updatedAt: new Date(),
    },
  });
  revalidatePath("/manage/schedule");
  revalidatePath("/");
}

