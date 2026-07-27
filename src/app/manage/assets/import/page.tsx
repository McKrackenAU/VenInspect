import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createAssetImportGrant } from "@/lib/import-grant";
import { AssetImportForm } from "@/components/AssetImportForm";

export const dynamic = "force-dynamic";

export default async function ManageAssetImportPage() {
  // Layout already requires admin; mint a short opaque grant so the upload
  // API does not depend on Cookie headers or long HMAC query tokens.
  const admin = await requireAdmin();
  const importGrant = createAssetImportGrant(admin);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-sm text-[color:var(--ventia-muted)]">
          <Link
            href="/manage/assets"
            className="text-[color:var(--ventia-blue)] hover:underline"
          >
            Asset registry
          </Link>{" "}
          / Import
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[color:var(--ventia-green)]">
          Import assets
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Management only. Upload an Asset Vision bridge/culvert export or a CSV
          with Code, Name, and optional Latitude/Longitude columns. Bulk imports
          of hundreds of assets are supported.
        </p>
      </div>
      <AssetImportForm importGrant={importGrant} />
    </div>
  );
}
