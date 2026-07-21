import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canEditInspection } from "@/lib/inspection-access";
import { nextDefectCode } from "@/lib/inspection";
import { saveCompressedDefectPhoto } from "@/lib/photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Multipart defect create — preferred on mobile vs server actions (large photos).
 * POST /api/inspections/[id]/defects
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id: inspectionId } = await context.params;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not read upload (file may be too large or the connection dropped). Try a smaller photo.",
      },
      { status: 413 },
    );
  }

  const description = String(formData.get("description") ?? "").trim();
  const comments = String(formData.get("comments") ?? "") || null;
  const category = String(formData.get("category") ?? "") || null;
  const subcategory = String(formData.get("subcategory") ?? "") || null;
  const severity =
    String(formData.get("severity") ?? "MEDIUM").trim() || "MEDIUM";
  const photo = formData.get("photo");

  if (!description) {
    return NextResponse.json(
      { error: "Description is required" },
      { status: 400 },
    );
  }

  const blob =
    photo instanceof Blob && photo.size > 0
      ? photo
      : null;
  if (!blob) {
    return NextResponse.json(
      { error: "Defect photo is required" },
      { status: 400 },
    );
  }

  try {
    const inspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: { asset: true, defects: true },
    });
    if (!inspection) {
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
    }
    if (!canEditInspection(user, inspection)) {
      return NextResponse.json(
        { error: "Cannot edit this inspection" },
        { status: 403 },
      );
    }

    const defectCode = nextDefectCode(
      inspection.asset.assetNumber,
      inspection.defects.map((d) => d.defectCode),
    );

    const buffer = Buffer.from(await blob.arrayBuffer());
    const originalName =
      photo instanceof File ? photo.name : String(formData.get("photoName") ?? "");

    const { relativePath } = await saveCompressedDefectPhoto({
      buffer,
      roadName: inspection.asset.roadName || "Unknown Road",
      assetNumber: inspection.asset.assetNumber,
      folderKey: inspection.folderKey,
      defectCode,
      originalName,
    });

    const defect = await prisma.defect.create({
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
    revalidatePath(`/inspections/${inspectionId}/report`);
    revalidatePath(`/assets/${inspection.assetId}`);

    return NextResponse.json({
      ok: true,
      defect: { id: defect.id, defectCode: defect.defectCode },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not save defect";
    console.error("[defects POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
