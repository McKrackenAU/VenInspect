import { formatAppVersion, getAppVersion, getConfiguredUpdateChannel } from "@/lib/version";
import { SystemUpdatePanel } from "@/components/SystemUpdatePanel";
import { MapsApiKeyForm } from "@/components/MapsApiKeyForm";
import { DateTimePrefsForm } from "@/components/DateTimePrefsForm";
import { PhotoStoragePicker } from "@/components/PhotoStoragePicker";
import {
  describeStorage,
  getGoogleMapsApiKey,
  getMapProvider,
  getNearmapApiKey,
  mapsApiKeySource,
  readStorageSettings,
} from "@/lib/paths";
import { getDateTimePrefs } from "@/lib/date-time";
import Link from "next/link";
import { requireAdmin, getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ photoError?: string; photoSaved?: string }>;
};

export default async function ManageSystemPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const user = await getCurrentUser();
  const version = formatAppVersion(getAppVersion());
  const channel = getConfiguredUpdateChannel();
  const storage = describeStorage();
  const mapsSource = mapsApiKeySource();
  const mapsKey = getGoogleMapsApiKey();
  const settingsKey = readStorageSettings().googleMapsApiKey?.trim() || null;
  const nearmapKey = getNearmapApiKey();
  const mapProvider = getMapProvider();
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
        <h2 className="text-lg font-medium">Photo storage</h2>
        <p className="text-sm text-[color:var(--ventia-muted)]">
          Browse mounted disks (e.g. TrueNAS bind at <code>/mnt/…</code>) and set where
          inspection photos are stored. Database stays on{" "}
          <code>{storage.dataDir}</code>.
        </p>
        <PhotoStoragePicker
          currentPath={storage.photoDir}
          sourceLabel={storage.photoDirSource}
          envLocked={Boolean(process.env.PHOTO_DIR?.trim())}
          returnTo="/manage/system"
          flashError={sp.photoError ?? null}
          flashSaved={sp.photoSaved === "1"}
        />
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
        <h2 className="text-lg font-medium">Maps</h2>
        <MapsApiKeyForm
          source={mapsSource}
          mapProvider={mapProvider}
          googleApiKey={mapsKey ?? settingsKey ?? ""}
          nearmapApiKey={nearmapKey ?? ""}
          nearmapLocked={Boolean(process.env.NEARMAP_API_KEY?.trim())}
        />
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-medium">Admin tools</h2>
        <p className="text-sm text-[color:var(--ventia-muted)]">
          Shortcuts for trash, defect task lists, remote access, and Assetvision.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <Link
            href="/manage/trash"
            className="rounded-xl border border-[color:var(--ventia-border)] p-4 transition hover:border-[color:var(--ventia-green)] hover:bg-[color:var(--ventia-green-tint)]"
          >
            <p className="font-semibold text-[color:var(--ventia-green)]">Trash</p>
            <p className="mt-1 text-xs text-[color:var(--ventia-muted)]">
              Soft-deleted reports — restore or purge after 30 days
            </p>
          </Link>
          <Link
            href="/manage/task-types"
            className="rounded-xl border border-[color:var(--ventia-border)] p-4 transition hover:border-[color:var(--ventia-green)] hover:bg-[color:var(--ventia-green-tint)]"
          >
            <p className="font-semibold text-[color:var(--ventia-green)]">
              Defect task types
            </p>
            <p className="mt-1 text-xs text-[color:var(--ventia-muted)]">
              RM, Investigate, Monitor, FMRP, and custom task labels
            </p>
          </Link>
          {isRoot ? (
            <Link
              href="/manage/system/tunnel"
              className="rounded-xl border border-[color:var(--ventia-border)] p-4 transition hover:border-[color:var(--ventia-green)] hover:bg-[color:var(--ventia-green-tint)]"
            >
              <p className="font-semibold text-[color:var(--ventia-green)]">
                Cloudflare Tunnel
              </p>
              <p className="mt-1 text-xs text-[color:var(--ventia-muted)]">
                Root-only remote HTTPS without opening office ports
              </p>
            </Link>
          ) : null}
          <Link
            href="/manage/system/email"
            className="rounded-xl border border-[color:var(--ventia-border)] p-4 transition hover:border-[color:var(--ventia-green)] hover:bg-[color:var(--ventia-green-tint)]"
          >
            <p className="font-semibold text-[color:var(--ventia-green)]">
              Outbound email
            </p>
            <p className="mt-1 text-xs text-[color:var(--ventia-muted)]">
              SMTP for password resets from noreply@inspect-it.online
            </p>
          </Link>
          <Link
            href="/manage/system/assetvision"
            className="rounded-xl border border-[color:var(--ventia-border)] p-4 transition hover:border-[color:var(--ventia-green)] hover:bg-[color:var(--ventia-green-tint)]"
          >
            <p className="font-semibold text-[color:var(--ventia-green)]">
              Assetvision
            </p>
            <p className="mt-1 text-xs text-[color:var(--ventia-muted)]">
              REST base URL / API key for asset pull and report push
            </p>
          </Link>
        </div>
      </section>

      <SystemUpdatePanel currentLabel={version} defaultChannel={channel} />
    </div>
  );
}
