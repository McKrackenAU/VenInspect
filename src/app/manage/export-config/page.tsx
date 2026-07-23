import { getExportConfig } from "@/lib/export-config";
import { getSeverityOptions } from "@/lib/severities";
import { ExportConfigForm } from "@/components/ExportConfigForm";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManageExportConfigPage() {
  await requireAdmin();
  const config = getExportConfig();
  const states = getSeverityOptions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
          Export configurator
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[color:var(--ventia-muted)]">
          Control what Client Export packs include, and which condition states (1–4)
          are selected by default. Inspectors still pick states for each export they
          run.
        </p>
      </div>
      <div className="card p-5">
        <ExportConfigForm initial={config} conditionStates={states} />
      </div>
    </div>
  );
}
