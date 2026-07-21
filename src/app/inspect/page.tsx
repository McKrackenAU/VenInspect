import { prisma } from "@/lib/db";
import { InspectStartForm } from "@/components/InspectStartForm";

export const dynamic = "force-dynamic";

export default async function InspectPage({
  searchParams,
}: {
  searchParams: Promise<{ assetId?: string }>;
}) {
  const { assetId: preselect } = await searchParams;
  const assets = await prisma.asset.findMany({
    orderBy: [{ roadName: "asc" }, { assetNumber: "asc" }],
    select: {
      id: true,
      assetNumber: true,
      name: true,
      roadName: true,
      type: true,
      requireConfinedSpace: true,
      requireTrafficManagement: true,
      requireWorkingAtHeights: true,
    },
  });

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <p className="text-sm font-medium text-[color:var(--ventia-muted)]">Step 1 of 2</p>
        <h1 className="text-2xl font-bold text-[color:var(--ventia-green)]">
          Start inspection
        </h1>
        <p className="mt-1 text-base text-[color:var(--ventia-muted)]">
          Find the structure, choose the type, confirm any site permits, then tap Next. A private
          draft is saved so you can leave and come back.
        </p>
      </div>

      <InspectStartForm assets={assets} defaultAssetId={preselect} />
    </div>
  );
}
