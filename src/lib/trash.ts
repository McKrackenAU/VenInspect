import { requireAdmin, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const TRASH_DAYS = 30;

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

export async function purgeOldTrashAction(_formData?: FormData) {
  await requireAdmin();
  const cutoff = new Date(Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000);
  const old = await prisma.inspection.findMany({
    where: { deletedAt: { lt: cutoff } },
    select: { id: true },
  });
  for (const row of old) {
    await prisma.inspection.delete({ where: { id: row.id } });
  }
  revalidatePath("/manage/trash");
}
