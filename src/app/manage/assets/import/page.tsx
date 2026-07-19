import Link from "next/link";
import { AssetImportForm } from "@/components/AssetImportForm";

export default function ManageAssetImportPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-sm text-[color:var(--ventia-muted)]">
          <Link href="/manage/assets" className="text-[color:var(--ventia-blue)] hover:underline">
            Asset registry
          </Link>{" "}
          / Import
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[color:var(--ventia-green)]">
          Import assets
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Management only. Upload an Asset Vision bridge/culvert export or a CSV with
          Code, Name, and optional Latitude/Longitude columns. Noise wall lists can use
          the same format with Type = Noise wall.
        </p>
      </div>
      <AssetImportForm />
    </div>
  );
}
