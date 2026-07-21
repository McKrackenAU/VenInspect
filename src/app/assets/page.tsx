import { prisma } from "@/lib/db";
import { computeLevelSchedule, formatAssetType, formatNextDue } from "@/lib/inspection";
import { AssetFinder } from "@/components/AssetFinder";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  // Light query: asset rows + only schedule fields from completed inspections.
  // Never pull defects/categories/photos for the whole registry.
  const [assets, scheduleRows] = await Promise.all([
    prisma.asset.findMany({
      select: {
        id: true,
        assetNumber: true,
        name: true,
        roadName: true,
        type: true,
        level1IntervalYears: true,
        level2IntervalYears: true,
        _count: { select: { inspections: true } },
      },
      orderBy: [{ roadName: "asc" }, { assetNumber: "asc" }],
    }),
    prisma.inspection.findMany({
      where: {
        status: { in: ["APPROVED", "SUBMITTED", "PENDING_APPROVAL"] },
      },
      select: {
        assetId: true,
        level: true,
        status: true,
        inspectedAt: true,
        approvedAt: true,
      },
      orderBy: { inspectedAt: "desc" },
    }),
  ]);

  const byAsset = new Map<string, typeof scheduleRows>();
  for (const row of scheduleRows) {
    const list = byAsset.get(row.assetId);
    if (list) list.push(row);
    else byAsset.set(row.assetId, [row]);
  }

  const rows = assets.map((asset) => {
    const roadName = asset.roadName?.trim() || "Unknown Road";
    const inspections = byAsset.get(asset.id) ?? [];
    const l1 = computeLevelSchedule(asset, inspections, "LEVEL_1");
    const l2 = computeLevelSchedule(asset, inspections, "LEVEL_2");
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
