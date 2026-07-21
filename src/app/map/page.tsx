import { prisma } from "@/lib/db";
import { formatAssetType } from "@/lib/inspection";
import { AssetMap } from "@/components/AssetMap";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const assets = await prisma.asset.findMany({
    orderBy: [{ roadName: "asc" }, { assetNumber: "asc" }],
    select: {
      id: true,
      assetNumber: true,
      name: true,
      roadName: true,
      type: true,
      latitude: true,
      longitude: true,
    },
  });

  const mapped = assets
    .filter(
      (a) =>
        a.latitude != null &&
        a.longitude != null &&
        Number.isFinite(a.latitude) &&
        Number.isFinite(a.longitude),
    )
    .map((a) => ({
      id: a.id,
      assetNumber: a.assetNumber,
      name: a.name,
      roadName: a.roadName,
      typeLabel: formatAssetType(a.type),
      latitude: a.latitude as number,
      longitude: a.longitude as number,
    }));

  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--ventia-green)]">Asset map</h1>
        <p className="mt-1 text-base text-[color:var(--ventia-muted)]">
          Find structures on the map. In the field, use your location to list nearby assets.
        </p>
      </div>
      <AssetMap assets={mapped} apiKey={apiKey} />
    </div>
  );
}
