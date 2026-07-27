import { AssetTypesForm } from "@/components/AssetTypesForm";
import { getAssetTypes } from "@/lib/asset-types";

export const dynamic = "force-dynamic";

export default function ManageAssetTypesPage() {
  const types = getAssetTypes();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
          Asset types
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Manage the asset categories available in the registry and asset editor.
          Sub-classifications (e.g. ped underpass) are under{" "}
          <a
            href="/manage/asset-subclasses"
            className="text-[color:var(--ventia-blue)] underline-offset-2 hover:underline"
          >
            Asset subclasses
          </a>
          .
        </p>
      </div>
      <div className="card p-5">
        <AssetTypesForm initial={types} />
      </div>
    </div>
  );
}
