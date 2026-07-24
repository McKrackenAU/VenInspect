import type { AuthUser } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";

/** Drafts are private to the creator; admins see everything. */
export function inspectionVisibilityWhere(
  user: AuthUser,
): Prisma.InspectionWhereInput {
  if (user.role === "ADMIN") return { deletedAt: null };
  return {
    deletedAt: null,
    OR: [{ status: { not: "DRAFT" } }, { createdById: user.id }],
  };
}

export function canViewInspection(
  user: AuthUser,
  inspection: { status: string; createdById: string; deletedAt?: Date | null },
): boolean {
  if (inspection.deletedAt && user.role !== "ADMIN") return false;
  if (user.role === "ADMIN") return true;
  if (inspection.status !== "DRAFT") return true;
  return inspection.createdById === user.id;
}

export function canEditInspection(
  user: AuthUser,
  inspection: { status: string; createdById: string },
): boolean {
  // Submitted / approved reports are read-only until explicitly reopened via "Edit report"
  if (inspection.status !== "DRAFT" && inspection.status !== "REJECTED") {
    return false;
  }
  return user.role === "ADMIN" || inspection.createdById === user.id;
}
