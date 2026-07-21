import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canViewInspection } from "@/lib/inspection-access";
import { buildInspectionPdf, pdfFilename } from "@/lib/report-pdf";
import {
  getTemplateForLevel,
  parseFormPayload,
} from "@/lib/inspection-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await context.params;

  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: {
      asset: true,
      createdBy: true,
      approvedBy: true,
      categories: { orderBy: [{ category: "asc" }, { subcategory: "asc" }] },
      defects: { orderBy: { defectCode: "asc" } },
    },
  });

  if (!inspection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canViewInspection(user, inspection)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scopeParam = req.nextUrl.searchParams.get("defects");
  const scopeIds = scopeParam
    ? new Set(
        scopeParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
    : null;

  const defects = scopeIds
    ? inspection.defects.filter((d) => scopeIds.has(d.id))
    : inspection.defects;

  const pdf = await buildInspectionPdf({
    inspectionId: inspection.id,
    level: inspection.level,
    status: inspection.status,
    inspectedAt: inspection.inspectedAt,
    submittedAt: inspection.submittedAt,
    approvedAt: inspection.approvedAt,
    generalComments: inspection.generalComments,
    titleLabel: inspection.titleLabel,
    inspectorName: inspection.createdBy.name,
    approverName: inspection.approvedBy?.name ?? null,
    asset: inspection.asset,
    categories: scopeIds ? [] : inspection.categories,
    defects,
    template: scopeIds ? null : getTemplateForLevel(inspection.level),
    formPayload: scopeIds ? null : parseFormPayload(inspection.formPayload),
    scopeOnly: Boolean(scopeIds),
    generatedByName: user.name,
  });

  const filename = pdfFilename({
    assetNumber: inspection.asset.assetNumber,
    inspectedAt: inspection.inspectedAt,
    level: inspection.level,
    scopeOnly: Boolean(scopeIds),
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
