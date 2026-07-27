import { prisma } from "@/lib/db";
import { formatAssetType } from "@/lib/inspection";
import { AssetMap } from "@/components/AssetMap";
import {
  getGoogleMapsApiKey,
  getMapProvider,
  getNearmapApiKey,
} from "@/lib/paths";

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

  const provider = getMapProvider();
  const googleApiKey = getGoogleMapsApiKey();
  const nearmapApiKey = getNearmapApiKey();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--ventia-green)]">
          Asset map
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Search the panel to find assets. Use your location for nearby results.
        </p>
      </div>
      <AssetMap
        assets={mapped}
        provider={provider}
        googleApiKey={googleApiKey}
        nearmapApiKey={nearmapApiKey}
      />
    </div>
  );
}
