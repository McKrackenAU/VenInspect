import { describeStorage } from "@/lib/paths";
import { PhotoStoragePicker } from "@/components/PhotoStoragePicker";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ManageStoragePage() {
  await requireAdmin();
  const storage = describeStorage();
  const envLocked = Boolean(process.env.PHOTO_DIR?.trim());

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
          Photo storage
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Keep the SQLite database on the main disk via <code>DATA_DIR</code>. Point photos
          at a larger mounted volume when you have one.
        </p>
        <p className="mt-2 text-sm">
          <Link
            href="/manage/system"
            className="font-semibold text-[color:var(--ventia-green)] hover:underline"
          >
            ← System settings
          </Link>
        </p>
      </div>

      <section className="rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-5 shadow-sm text-sm space-y-2">
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
          Layout:{" "}
          <code>
            {storage.photoDir}/&lt;Road&gt;/&lt;AssetCode&gt;/&lt;DDMMYYYY&gt;/….webp
          </code>
        </p>
      </section>

      <section className="rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-5 shadow-sm">
        <PhotoStoragePicker
          currentPath={storage.photoDir}
          sourceLabel={storage.photoDirSource}
          envLocked={envLocked}
          returnTo="/manage/storage"
        />
      </section>
    </div>
  );
}
