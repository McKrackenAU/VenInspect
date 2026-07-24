import { formatAppVersion, getAppVersion, getConfiguredUpdateChannel } from "@/lib/version";
import { SystemUpdatePanel } from "@/components/SystemUpdatePanel";
import { MapsApiKeyForm } from "@/components/MapsApiKeyForm";
import { DateTimePrefsForm } from "@/components/DateTimePrefsForm";
import {
  describeStorage,
  getGoogleMapsApiKey,
  mapsApiKeySource,
  readStorageSettings,
} from "@/lib/paths";
import { getDateTimePrefs } from "@/lib/date-time";
import Link from "next/link";
import { requireAdmin, getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function maskKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

export default async function ManageSystemPage() {
  await requireAdmin();
  const user = await getCurrentUser();
  const version = formatAppVersion(getAppVersion());
  const channel = getConfiguredUpdateChannel();
  const storage = describeStorage();
  const mapsSource = mapsApiKeySource();
  const mapsKey = getGoogleMapsApiKey();
  const settingsKey = readStorageSettings().googleMapsApiKey?.trim() || null;
  const dt = getDateTimePrefs();
  const isRoot = user?.username === "root";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
          System settings
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Version, date/time, Maps API key, and in-app updates from Gitea or GitHub.
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
        <h2 className="text-lg font-medium">Date & time</h2>
        <p className="text-sm text-[color:var(--ventia-muted)]">
          Controls welcome greetings and preferred display formatting.
        </p>
        <DateTimePrefsForm
          timezone={dt.timezone}
          dateFormat={dt.dateFormat}
          timeFormat={dt.timeFormat}
        />
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-medium">Google Maps</h2>
        <MapsApiKeyForm
          source={mapsSource}
          configured={Boolean(mapsKey)}
          maskedKey={maskKey(mapsKey ?? settingsKey)}
        />
      </section>

      <section className="card space-y-2 p-5">
        <h2 className="text-lg font-medium">More</h2>
        <ul className="space-y-1 text-sm">
          <li>
            <Link
              href="/manage/trash"
              className="font-semibold text-[color:var(--ventia-blue)] hover:underline"
            >
              Trash (soft-deleted reports)
            </Link>
          </li>
          <li>
            <Link
              href="/manage/task-types"
              className="font-semibold text-[color:var(--ventia-blue)] hover:underline"
            >
              Defect task types
            </Link>
          </li>
          {isRoot ? (
            <li>
              <Link
                href="/manage/system/tunnel"
                className="font-semibold text-[color:var(--ventia-blue)] hover:underline"
              >
                Cloudflare Tunnel (root)
              </Link>
            </li>
          ) : null}
          <li>
            <Link
              href="/manage/system/assetvision"
              className="font-semibold text-[color:var(--ventia-blue)] hover:underline"
            >
              Assetvision integration
            </Link>
          </li>
        </ul>
      </section>

      <SystemUpdatePanel currentLabel={version} defaultChannel={channel} />
    </div>
  );
}
