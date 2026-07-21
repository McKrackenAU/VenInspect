import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatAssetType } from "@/lib/inspection";
import { upsertAssetManual } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function ManageAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q, type } = await searchParams;
  const assets = await prisma.asset.findMany({
    where: {
      AND: [
        type ? { type: type as "BRIDGE" | "DRAINAGE" | "NOISE_WALL" } : {},
        q
          ? {
              OR: [
                { assetNumber: { contains: q } },
                { name: { contains: q } },
                { roadName: { contains: q } },
                { assetVisionId: { contains: q } },
              ],
            }
          : {},
      ],
    },
    orderBy: [{ roadName: "asc" }, { assetNumber: "asc" }],
  });

  const byRoad = new Map<string, typeof assets>();
  for (const a of assets) {
    const road = a.roadName || "Unknown Road";
    const list = byRoad.get(road) ?? [];
    list.push(a);
    byRoad.set(road, list);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
            Asset registry
          </h1>
          <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
            Grouped by <strong>road name</strong>, then asset code. Photos land under{" "}
            <code className="text-xs">{"{PHOTO_DIR}/{Road}/{Code}/{date}/"}</code>.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/manage/storage"
            className="rounded-md border border-[color:var(--ventia-green)] px-3 py-2 text-sm text-[color:var(--ventia-green)]"
          >
            Photo storage
          </Link>
          <Link
            href="/manage/assets/import"
            className="rounded-md bg-[color:var(--ventia-green)] px-3 py-2 text-sm font-medium text-white"
          >
            Import Excel / CSV
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search road, code, name, Asset Vision ID…"
          className="min-w-[16rem] flex-1 rounded-md border border-[color:var(--ventia-border)] bg-[color:var(--panel)] px-3 py-2 text-sm"
        />
        <select
          name="type"
          defaultValue={type ?? ""}
          className="rounded-md border border-[color:var(--ventia-border)] bg-[color:var(--panel)] px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          <option value="BRIDGE">Bridge</option>
          <option value="DRAINAGE">Drainage</option>
          <option value="NOISE_WALL">Noise wall</option>
        </select>
        <button
          type="submit"
          className="rounded-md border border-[color:var(--ventia-green)] px-3 py-2 text-sm text-[color:var(--ventia-green)]"
        >
          Filter
        </button>
      </form>

      <p className="text-sm text-[color:var(--ventia-muted)]">
        {assets.length} assets · {byRoad.size} roads
      </p>

      <div className="space-y-6">
        {[...byRoad.entries()].map(([road, list]) => (
          <section
            key={road}
            className="overflow-hidden rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] shadow-sm"
          >
            <h2 className="border-b border-[color:var(--ventia-border)] bg-[color:var(--ventia-green-tint)] px-4 py-2.5 text-sm font-semibold text-[color:var(--ventia-green)]">
              {road}{" "}
              <span className="font-normal text-[color:var(--ventia-muted)]">
                ({list.length})
              </span>
            </h2>
            <table className="w-full text-left text-sm">
              <thead className="text-[color:var(--ventia-muted)]">
                <tr className="border-b border-[color:var(--ventia-border)]">
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Asset Vision</th>
                  <th className="px-3 py-2 font-medium">Lat/Long</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} className="border-b border-[color:var(--ventia-border)]">
                    <td className="px-3 py-2 font-mono font-semibold text-[color:var(--ventia-green)]">
                      <Link href={`/assets/${a.id}`} className="hover:underline">
                        {a.assetNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{a.name}</td>
                    <td className="px-3 py-2">{formatAssetType(a.type)}</td>
                    <td className="px-3 py-2 text-[color:var(--ventia-muted)]">
                      {a.assetVisionId ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-[color:var(--ventia-muted)]">
                      {a.latitude != null && a.longitude != null
                        ? `${a.latitude}, ${a.longitude}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>

      <section className="rounded-xl border border-dashed border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-5">
        <h2 className="font-medium">Add / update single asset</h2>
        <form action={upsertAssetManual} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            name="roadName"
            required
            placeholder="Road name * (grouping key)"
            className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            name="assetNumber"
            required
            placeholder="Code * (e.g. SN1204)"
            className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
          />
          <input
            name="name"
            required
            placeholder="Name *"
            className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
          />
          <select
            name="type"
            className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
          >
            <option value="BRIDGE">Bridge</option>
            <option value="DRAINAGE">Drainage</option>
            <option value="NOISE_WALL">Noise wall</option>
          </select>
          <input
            name="assetVisionId"
            placeholder="Asset Vision ID"
            className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
          />
          <input
            name="location"
            placeholder="Location description"
            className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
          />
          <input
            name="latitude"
            placeholder="Latitude"
            className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
          />
          <input
            name="longitude"
            placeholder="Longitude"
            className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="sm:col-span-2 rounded-md bg-[color:var(--ventia-blue)] px-4 py-2 text-sm font-semibold text-white"
          >
            Save asset
          </button>
        </form>
      </section>
    </div>
  );
}
