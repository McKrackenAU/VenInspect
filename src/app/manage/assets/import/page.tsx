import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { signAssetImportTicket } from "@/lib/import-ticket";
import { AssetImportForm } from "@/components/AssetImportForm";

export const dynamic = "force-dynamic";

export default async function ManageAssetImportPage() {
  // Layout already requires admin; re-load here so we can mint an import ticket
  // tied to this admin session (multipart uploads can drop/omit cookies).
  const admin = await requireAdmin();
  const importTicket = await signAssetImportTicket(admin);

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
      <AssetImportForm importTicket={importTicket} />
    </div>
  );
}
