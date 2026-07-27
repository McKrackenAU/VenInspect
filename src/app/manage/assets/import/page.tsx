import Link from "next/link";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAssetImportGrant } from "@/lib/import-grant";
import { formatAppVersion, getAppVersion } from "@/lib/version";
import { AssetImportForm } from "@/components/AssetImportForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ManageAssetImportPage() {
  // Force a real request — never serve a cached RSC payload with a dead grant.
  await connection();

  const admin = await requireAdmin();
  let importGrant = "";
  let grantError: string | null = null;
  try {
    importGrant = createAssetImportGrant(admin);
  } catch (e) {
    grantError =
      e instanceof Error
        ? `Could not create import grant: ${e.message}`
        : "Could not create import grant (check DATA_DIR permissions).";
  }

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
      {grantError ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {grantError}
        </p>
      ) : (
        <AssetImportForm
          importGrant={importGrant}
          appVersion={formatAppVersion(getAppVersion())}
        />
      )}
    </div>
  );
}
