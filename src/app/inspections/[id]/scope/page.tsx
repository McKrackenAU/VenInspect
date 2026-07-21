import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canViewInspection } from "@/lib/inspection-access";
import { ScopeDefectPicker } from "@/components/ScopeDefectPicker";
import { severityLabel } from "@/lib/severities";

export const dynamic = "force-dynamic";

export default async function ScopeExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: {
      asset: true,
      createdBy: true,
      defects: { orderBy: { defectCode: "asc" } },
    },
  });
  if (!inspection) notFound();
  if (!canViewInspection(user, inspection)) redirect("/assets");

  return (
    <div className="space-y-4">
      <p className="no-print text-sm text-[color:var(--ventia-muted)]">
        <Link
          href={`/inspections/${inspection.id}/report`}
          className="text-[color:var(--ventia-blue)] hover:underline"
        >
          ← Back to report
        </Link>
        {" · "}
        <Link
          href={`/inspections/${inspection.id}`}
          className="text-[color:var(--ventia-blue)] hover:underline"
        >
          Inspection
        </Link>
      </p>
      <h1 className="no-print text-2xl font-semibold text-[color:var(--ventia-green)]">
        Scope document
      </h1>
      <p className="no-print text-sm text-[color:var(--ventia-muted)]">
        Select defects for works scoping, then export a formatted PDF.
      </p>
      <ScopeDefectPicker
        inspectionId={inspection.id}
        titleLabel={inspection.titleLabel}
        roadName={inspection.asset.roadName}
        assetNumber={inspection.asset.assetNumber}
        assetName={inspection.asset.name}
        submittedAtIso={inspection.submittedAt.toISOString()}
        inspectorName={inspection.createdBy.name}
        defects={inspection.defects.map((d) => ({
          id: d.id,
          defectCode: d.defectCode,
          description: d.description,
          comments: d.comments,
          severity: d.severity,
          severityLabel: severityLabel(d.severity),
          category: d.category,
          subcategory: d.subcategory,
          photoPath: d.photoPath,
          comparisonPhotoPath: d.comparisonPhotoPath,
        }))}
      />
    </div>
  );
}
