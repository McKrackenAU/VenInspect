import { describeStorage, getPhotoDir } from "@/lib/paths";
import { savePhotoStoragePath } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function ManageStoragePage() {
  const storage = describeStorage();
  const envLocked = Boolean(process.env.PHOTO_DIR?.trim());

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
          Photo storage
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Keep the SQLite database on the main (smaller) disk via <code>DATA_DIR</code>.
          Point photos at a larger Proxmox passthrough volume when you have one — or leave
          blank to use <code>{`{DATA_DIR}/photos`}</code> on the same disk.
        </p>
      </div>

      <section className="rounded-xl border border-[color:var(--ventia-border)] bg-white p-5 shadow-sm text-sm space-y-2">
        <p>
          <span className="font-medium">Database (DATA_DIR):</span>{" "}
          <code className="text-xs">{storage.dataDir}</code>
        </p>
        <p>
          <span className="font-medium">Photos (active):</span>{" "}
          <code className="text-xs">{storage.photoDir}</code>
        </p>
        <p className="text-[color:var(--ventia-muted)]">
          Source: {storage.photoDirSource}
        </p>
        <p className="text-xs text-[color:var(--ventia-muted)]">
          Folder layout:{" "}
          <code>
            {getPhotoDir()}/&lt;Road&gt;/&lt;AssetCode&gt;/&lt;DDMMYYYY&gt;/SN1234-D001.webp
          </code>
          . Same-day second inspection uses <code>DDMMYYYY-HHmmss</code>.
        </p>
      </section>

      <form
        action={savePhotoStoragePath}
        className="space-y-4 rounded-xl border border-[color:var(--ventia-border)] bg-white p-5 shadow-sm"
      >
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Photo directory path</span>
          <input
            name="photoDir"
            defaultValue={
              process.env.PHOTO_DIR?.trim() ||
              (storage.photoDirSource === "settings.json" ? storage.photoDir : "")
            }
            disabled={envLocked}
            placeholder="/var/lib/veninspect-photos  or  D:\VenInspectPhotos"
            className="w-full rounded-md border border-[color:var(--ventia-border)] px-3 py-2 disabled:bg-slate-100"
          />
        </label>
        {envLocked ? (
          <p className="text-sm text-amber-800">
            Locked by environment variable <code>PHOTO_DIR</code>. Change it in{" "}
            <code>/etc/veninspect.env</code> on the LXC, then restart the service.
          </p>
        ) : (
          <p className="text-xs text-[color:var(--ventia-muted)]">
            Leave empty to reset to default <code>{`{DATA_DIR}/photos`}</code>. Path must be
            writable by the VenInspect service user.
          </p>
        )}
        {!envLocked && (
          <button
            type="submit"
            className="rounded-md bg-[color:var(--ventia-green)] px-4 py-2 text-sm font-semibold text-white"
          >
            Save photo path
          </button>
        )}
      </form>

      <section className="text-sm text-[color:var(--ventia-muted)] space-y-2">
        <h2 className="font-medium text-[color:var(--ventia-ink)]">Proxmox tip</h2>
        <p>
          Mount a large disk at e.g. <code>/mnt/veninspect-photos</code> in the CT, then set
          that path here (or <code>PHOTO_DIR=...</code> in the systemd env file). Keep{" "}
          <code>DATA_DIR=/var/lib/veninspect</code> on the rootfs for the lightweight DB.
        </p>
      </section>
    </div>
  );
}
