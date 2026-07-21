import type { AuthUser } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";

/** Drafts are private to the creator; admins see everything. */
export function inspectionVisibilityWhere(
  user: AuthUser,
): Prisma.InspectionWhereInput {
  if (user.role === "ADMIN") return {};
  return {
    OR: [{ status: { not: "DRAFT" } }, { createdById: user.id }],
  };
}

export function canViewInspection(
  user: AuthUser,
  inspection: { status: string; createdById: string },
): boolean {
  if (user.role === "ADMIN") return true;
  if (inspection.status !== "DRAFT") return true;
  return inspection.createdById === user.id;
}

export function canEditInspection(
  user: AuthUser,
  inspection: { status: string; createdById: string },
): boolean {
  if (inspection.status !== "DRAFT" && inspection.status !== "REJECTED") {
    return user.role === "ADMIN";
  }
  return user.role === "ADMIN" || inspection.createdById === user.id;
}
