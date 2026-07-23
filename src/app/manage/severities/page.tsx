import { getSeverityOptions } from "@/lib/severities";
import { SeveritySettingsForm } from "@/components/SeveritySettingsForm";

export const dynamic = "force-dynamic";

export default async function ManageSeveritiesPage() {
  const severities = getSeverityOptions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
          Condition states
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          These drive the defect “Condition state” dropdown and Client Export / PDF
          filters. Defaults: CS1 not significant → CS4 needs immediate attention.
        </p>
      </div>
      <div className="card p-5">
        <SeveritySettingsForm initial={severities} />
      </div>
    </div>
  );
}
