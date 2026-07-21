import { formatAppVersion, getAppVersion, getConfiguredUpdateChannel } from "@/lib/version";
import { SystemUpdatePanel } from "@/components/SystemUpdatePanel";
import { MapsApiKeyForm } from "@/components/MapsApiKeyForm";
import {
  describeStorage,
  getGoogleMapsApiKey,
  mapsApiKeySource,
  readStorageSettings,
} from "@/lib/paths";

export const dynamic = "force-dynamic";

function maskKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

export default async function ManageSystemPage() {
  const version = formatAppVersion(getAppVersion());
  const channel = getConfiguredUpdateChannel();
  const storage = describeStorage();
  const mapsSource = mapsApiKeySource();
  const mapsKey = getGoogleMapsApiKey();
  const settingsKey = readStorageSettings().googleMapsApiKey?.trim() || null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
          System settings
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Version, Maps API key, and in-app updates from Gitea or GitHub.
        </p>
      </div>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-medium">System info</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[color:var(--ventia-muted)]">Version</dt>
            <dd className="font-mono text-base font-semibold text-[color:var(--ventia-green)]">
              {version}
            </dd>
          </div>
          <div>
            <dt className="text-[color:var(--ventia-muted)]">Default update channel</dt>
            <dd className="font-medium capitalize">{channel}</dd>
          </div>
          <div>
            <dt className="text-[color:var(--ventia-muted)]">Data directory</dt>
            <dd className="break-all font-mono text-xs">{storage.dataDir}</dd>
          </div>
          <div>
            <dt className="text-[color:var(--ventia-muted)]">Photo directory</dt>
            <dd className="break-all font-mono text-xs">{storage.photoDir}</dd>
          </div>
          <div>
            <dt className="text-[color:var(--ventia-muted)]">Node</dt>
            <dd className="font-mono text-xs">{process.version}</dd>
          </div>
          <div>
            <dt className="text-[color:var(--ventia-muted)]">Platform</dt>
            <dd className="font-mono text-xs">
              {process.platform} / {process.arch}
            </dd>
          </div>
        </dl>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-medium">Google Maps</h2>
        <MapsApiKeyForm
          source={mapsSource}
          configured={Boolean(mapsKey)}
          maskedKey={maskKey(mapsKey ?? settingsKey)}
        />
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-medium">Updates</h2>
        <SystemUpdatePanel currentLabel={version} defaultChannel={channel} />
      </section>
    </div>
  );
}
