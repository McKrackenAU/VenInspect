import { getInspectionTypes } from "@/lib/inspection-types";
import { InspectionTypesForm } from "@/components/InspectionTypesForm";

export const dynamic = "force-dynamic";

export default async function ManageInspectionTypesPage() {
  const types = getInspectionTypes();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
          Inspection types
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          These options appear on <strong>Start inspection</strong>. Set how many{" "}
          <strong>years between inspections</strong> for each type — due / overdue
          dates use that interval. Existing types without an interval get Level 1 = 3
          years and Level 2 = 5 years automatically; saving applies Level 1 / Level 2
          intervals to every asset.
        </p>
      </div>
      <div className="card p-5">
        <InspectionTypesForm initial={types} />
      </div>
    </div>
  );
}
