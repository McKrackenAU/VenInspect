import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { updateAssetDetails } from "@/lib/actions";
import { formatAssetType } from "@/lib/inspection";
import { ASSET_PERMIT_FLAGS } from "@/lib/permits";

export const dynamic = "force-dynamic";

export default async function ManageAssetEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { saved } = await searchParams;
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/manage/assets"
          className="text-sm text-[color:var(--ventia-blue)] hover:underline"
        >
          ← Asset registry
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[color:var(--ventia-green)]">
          Edit {asset.assetNumber}
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Admin-only details, coordinates, and site permit flags. Field users still open{" "}
          <Link href={`/assets/${asset.id}`} className="underline">
            the user asset page
          </Link>{" "}
          for history and photos.
        </p>
      </div>

      {saved ? (
        <p className="rounded-lg border border-[color:var(--ventia-border)] bg-[color:var(--ventia-green-tint)] px-3 py-2 text-sm">
          Saved.
        </p>
      ) : null}

      <form action={updateAssetDetails} className="card space-y-4 p-5">
        <input type="hidden" name="id" value={asset.id} />

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="font-medium text-[color:var(--ventia-muted)]">Road name</span>
            <input
              name="roadName"
              required
              defaultValue={asset.roadName}
              className="field-input w-full"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[color:var(--ventia-muted)]">Code</span>
            <input
              name="assetNumber"
              required
              defaultValue={asset.assetNumber}
              className="field-input w-full font-mono"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[color:var(--ventia-muted)]">Type</span>
            <select name="type" defaultValue={asset.type} className="field-input w-full">
              <option value="BRIDGE">Bridge</option>
              <option value="DRAINAGE">Drainage</option>
              <option value="NOISE_WALL">Noise wall</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="font-medium text-[color:var(--ventia-muted)]">Name</span>
            <input name="name" required defaultValue={asset.name} className="field-input w-full" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[color:var(--ventia-muted)]">Asset Vision ID</span>
            <input
              name="assetVisionId"
              defaultValue={asset.assetVisionId ?? ""}
              className="field-input w-full"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[color:var(--ventia-muted)]">Classification</span>
            <input
              name="classification"
              defaultValue={asset.classification ?? ""}
              className="field-input w-full"
            />
          </label>
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="font-medium text-[color:var(--ventia-muted)]">Location</span>
            <input
              name="location"
              defaultValue={asset.location ?? ""}
              className="field-input w-full"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[color:var(--ventia-muted)]">Latitude</span>
            <input
              name="latitude"
              defaultValue={asset.latitude ?? ""}
              placeholder="-37.8"
              className="field-input w-full font-mono"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[color:var(--ventia-muted)]">Longitude</span>
            <input
              name="longitude"
              defaultValue={asset.longitude ?? ""}
              placeholder="144.9"
              className="field-input w-full font-mono"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[color:var(--ventia-muted)]">Level 1 interval (years)</span>
            <input
              name="level1IntervalYears"
              type="number"
              min={1}
              defaultValue={asset.level1IntervalYears}
              className="field-input w-full"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[color:var(--ventia-muted)]">Level 2 interval (years)</span>
            <input
              name="level2IntervalYears"
              type="number"
              min={1}
              defaultValue={asset.level2IntervalYears}
              className="field-input w-full"
            />
          </label>
        </div>

        <fieldset className="space-y-3 rounded-xl border border-[color:var(--ventia-border)] p-4">
          <legend className="px-1 text-sm font-semibold">
            Last inspection baselines (manual)
          </legend>
          <p className="text-xs text-[color:var(--ventia-muted)]">
            Use these when history isn’t in VenInspect yet. Due dates use the later of this
            baseline and any submitted inspection in the app. Clear a field to remove the
            baseline.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-[color:var(--ventia-muted)]">
                Last Level 1
              </span>
              <input
                name="lastLevel1At"
                type="date"
                defaultValue={
                  asset.lastLevel1At ? format(asset.lastLevel1At, "yyyy-MM-dd") : ""
                }
                className="field-input w-full"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-[color:var(--ventia-muted)]">
                Last Level 2
              </span>
              <input
                name="lastLevel2At"
                type="date"
                defaultValue={
                  asset.lastLevel2At ? format(asset.lastLevel2At, "yyyy-MM-dd") : ""
                }
                className="field-input w-full"
              />
            </label>
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="font-medium text-[color:var(--ventia-muted)]">Notes</span>
            <textarea
              name="notes"
              rows={3}
              defaultValue={asset.notes ?? ""}
              className="field-input w-full"
            />
          </label>
        </div>

        <fieldset className="space-y-2 rounded-xl border border-[color:var(--ventia-border)] p-4">
          <legend className="px-1 text-sm font-semibold">Required site permits</legend>
          <p className="text-xs text-[color:var(--ventia-muted)]">
            When flagged, inspectors must confirm each item when starting an inspection. Tracked on
            the web report only (not PDF).
          </p>
          {ASSET_PERMIT_FLAGS.map((f) => (
            <label key={f.key} className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name={f.assetField}
                defaultChecked={asset[f.assetField]}
                className="mt-1 h-4 w-4 accent-[color:var(--ventia-green)]"
              />
              <span>
                <span className="font-medium">{f.label}</span>
                <span className="block text-xs text-[color:var(--ventia-muted)]">{f.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary">
            Save asset
          </button>
          <Link
            href={`/assets/${asset.id}`}
            className="rounded-xl border border-[color:var(--ventia-border)] px-4 py-2.5 text-sm font-semibold"
          >
            Open user view
          </Link>
        </div>
        <p className="text-xs text-[color:var(--ventia-muted)]">
          Current type label: {formatAssetType(asset.type)}
        </p>
      </form>
    </div>
  );
}
