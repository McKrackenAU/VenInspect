import { AssetSubClassesForm } from "@/components/AssetSubClassesForm";
import { getAssetSubClasses } from "@/lib/asset-subclasses";
import { getAssetTypes } from "@/lib/asset-types";

export const dynamic = "force-dynamic";

export default function ManageAssetSubClassesPage() {
  const subClasses = getAssetSubClasses();
  const assetTypes = getAssetTypes();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
          Asset subclasses
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Manage sub-classifications used on assets (for example ped underpass
          under Bridge). Optionally limit each subclass to specific asset types.
        </p>
      </div>
      <div className="card p-5">
        <AssetSubClassesForm initial={subClasses} assetTypes={assetTypes} />
      </div>
    </div>
  );
}
