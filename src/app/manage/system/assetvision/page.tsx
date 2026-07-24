import { requireAdmin } from "@/lib/auth";
import { readStorageSettings } from "@/lib/paths";
import { AssetvisionConfigForm } from "@/components/AssetvisionConfigForm";

export const dynamic = "force-dynamic";

export default async function AssetvisionPage() {
  await requireAdmin();
  const s = readStorageSettings();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
          Assetvision integration
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Optional REST hooks to pull assets and push final report packs. Feature is
          flag-gated; leave blank for offline LAN-only use.
        </p>
      </div>
      <AssetvisionConfigForm
        baseUrl={s.assetvisionBaseUrl ?? ""}
        apiKey={s.assetvisionApiKey ?? ""}
      />
    </div>
  );
}
