import { prisma } from "@/lib/db";
import { computeLevelSchedule, formatAssetType } from "@/lib/inspection";
import { AssetFinder, formatNextDue } from "@/components/AssetFinder";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  // Keep this light — including full inspection graphs for the whole registry
  // can fail or hang on SQLite; manage/assets only loads asset rows.
  const assets = await prisma.asset.findMany({
    select: {
      id: true,
      assetNumber: true,
      name: true,
      roadName: true,
      type: true,
      level1IntervalYears: true,
      level2IntervalYears: true,
      _count: { select: { inspections: true } },
      inspections: {
        select: {
          level: true,
          status: true,
          inspectedAt: true,
          approvedAt: true,
        },
      },
    },
    orderBy: [{ roadName: "asc" }, { assetNumber: "asc" }],
  });

  const rows = assets.map((asset) => {
    const roadName = asset.roadName?.trim() || "Unknown Road";
    const l1 = computeLevelSchedule(asset, asset.inspections, "LEVEL_1");
    const l2 = computeLevelSchedule(asset, asset.inspections, "LEVEL_2");
    const worst =
      l1.status === "overdue" || l2.status === "overdue"
        ? l1.status === "overdue"
          ? l1
          : l2
        : l1.status === "due_soon" || l2.status === "due_soon"
          ? l1.status === "due_soon"
            ? l1
            : l2
          : l1;

    return {
      id: asset.id,
      assetNumber: asset.assetNumber,
      name: asset.name,
      roadName,
      typeLabel: formatAssetType(asset.type),
      reportCount: asset._count.inspections,
      nextDueLabel: formatNextDue(worst.status, worst.nextDueAt),
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--ventia-green)]">Find an asset</h1>
        <p className="mt-1 text-base text-[color:var(--ventia-muted)]">
          Search the road, then pick the structure code.
          {rows.length > 0 ? (
            <span className="text-[color:var(--ventia-muted)]">
              {" "}
              ({rows.length} in registry)
            </span>
          ) : null}
        </p>
      </div>
      <AssetFinder assets={rows} />
    </div>
  );
}
