import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ScopeDefectPicker } from "@/components/ScopeDefectPicker";

export const dynamic = "force-dynamic";

export default async function ScopeExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: {
      asset: true,
      defects: { orderBy: { defectCode: "asc" } },
    },
  });
  if (!inspection) notFound();

  return (
    <div className="space-y-4">
      <p className="text-sm text-[color:var(--ventia-muted)] print:hidden">
        <Link
          href={`/inspections/${inspection.id}`}
          className="text-[color:var(--ventia-blue)] hover:underline"
        >
          ← Back to inspection
        </Link>
      </p>
      <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)] print:hidden">
        Scope document
      </h1>
      <p className="text-sm text-[color:var(--ventia-muted)] print:hidden">
        Select defects to include (e.g. 12 of 85), then print / save as PDF for works
        scoping.
      </p>
      <ScopeDefectPicker
        titleLabel={inspection.titleLabel}
        roadName={inspection.asset.roadName}
        assetNumber={inspection.asset.assetNumber}
        submittedAtIso={inspection.submittedAt.toISOString()}
        defects={inspection.defects.map((d) => ({
          id: d.id,
          defectCode: d.defectCode,
          description: d.description,
          comments: d.comments,
          severity: d.severity,
          category: d.category,
          subcategory: d.subcategory,
          photoPath: d.photoPath,
        }))}
      />
    </div>
  );
}
