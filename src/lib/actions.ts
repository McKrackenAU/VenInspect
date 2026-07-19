"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { nextDefectCode } from "@/lib/inspection";
import { saveCompressedDefectPhoto } from "@/lib/photos";
import type { DefectSeverity, InspectionLevel } from "@/generated/prisma/client";

async function demoUser(prefer: "l1" | "l2" | "admin" = "l1") {
  const email =
    prefer === "admin"
      ? "admin@veninspect.local"
      : prefer === "l2"
        ? "l2@veninspect.local"
        : "l1@veninspect.local";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Seed users missing — run npm run db:seed");
  return user;
}

export async function createInspection(formData: FormData) {
  const assetId = String(formData.get("assetId") ?? "");
  const level = String(formData.get("level") ?? "LEVEL_1") as InspectionLevel;
  const generalComments = String(formData.get("generalComments") ?? "") || null;
  const actor = await demoUser("l1");

  if (!assetId) throw new Error("Asset required");

  if (level === "LEVEL_2" && !actor.level2Qualified && !actor.level1Qualified) {
    throw new Error("Inspector not qualified");
  }

  const requiresLevel2Approval = level === "LEVEL_2" && !actor.level2Qualified;
  const status = requiresLevel2Approval ? "PENDING_APPROVAL" : "SUBMITTED";

  const inspection = await prisma.inspection.create({
    data: {
      assetId,
      level,
      status,
      generalComments,
      createdById: actor.id,
      submittedAt: new Date(),
      requiresLevel2Approval,
    },
    include: { asset: true },
  });

  // Seed empty category comment rows for streamlined field entry
  const cats =
    inspection.asset.type === "BRIDGE"
      ? [
          ["Approaches", "Approach A"],
          ["Superstructure", "Deck"],
          ["Substructure", "Abutment A"],
          ["Waterway", "Channel"],
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
        message: `${inspection.asset.assetNumber} ${inspection.asset.name} — Level 2 draft by ${actor.name} needs verification.`,
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
    assetNumber: inspection.asset.assetNumber,
    inspectionId: inspection.id,
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
  const approver = await demoUser("l2");

  if (!approver.level2Qualified) {
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
  const approver = await demoUser("l2");

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
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "INSPECTOR") as "ADMIN" | "INSPECTOR";
  const level1Qualified = formData.get("level1Qualified") === "on";
  const level2Qualified = formData.get("level2Qualified") === "on";

  if (!name || !email) throw new Error("Name and email required");

  await prisma.user.create({
    data: { name, email, role, level1Qualified, level2Qualified },
  });

  revalidatePath("/admin");
}

export async function updateUserQualifications(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "INSPECTOR") as "ADMIN" | "INSPECTOR";
  const level1Qualified = formData.get("level1Qualified") === "on";
  const level2Qualified = formData.get("level2Qualified") === "on";

  await prisma.user.update({
    where: { id },
    data: { role, level1Qualified, level2Qualified },
  });

  revalidatePath("/admin");
}
