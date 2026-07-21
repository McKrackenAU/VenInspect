import { prisma } from "@/lib/db";
import { createInspection } from "@/lib/actions";
import { AssetPicker } from "@/components/AssetPicker";

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
          Find the structure, choose the level, then continue. A private draft is saved so
          you can leave and come back. Submit when you are finished.
        </p>
      </div>

      <form action={createInspection} className="card space-y-5 p-4 sm:p-5">
        <AssetPicker assets={assets} defaultAssetId={preselect} />

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Inspection type</legend>
          <label className="flex min-h-[3.25rem] cursor-pointer items-center gap-3 rounded-xl border border-[color:var(--ventia-border)] px-4 py-3 has-[:checked]:border-[color:var(--ventia-green)] has-[:checked]:bg-[color:var(--ventia-green-tint)]">
            <input
              type="radio"
              name="level"
              value="LEVEL_1"
              defaultChecked
              className="h-5 w-5 accent-[color:var(--ventia-green)]"
            />
            <span>
              <span className="block font-semibold">Level 1</span>
              <span className="text-xs text-[color:var(--ventia-muted)]">
                Routine check (about every 3 years)
              </span>
            </span>
          </label>
          <label className="flex min-h-[3.25rem] cursor-pointer items-center gap-3 rounded-xl border border-[color:var(--ventia-border)] px-4 py-3 has-[:checked]:border-[color:var(--ventia-green)] has-[:checked]:bg-[color:var(--ventia-green-tint)]">
            <input
              type="radio"
              name="level"
              value="LEVEL_2"
              className="h-5 w-5 accent-[color:var(--ventia-green)]"
            />
            <span>
              <span className="block font-semibold">Level 2</span>
              <span className="text-xs text-[color:var(--ventia-muted)]">
                Detailed check — may need a Level 2 person to approve
              </span>
            </span>
          </label>
        </fieldset>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Notes (optional)</span>
          <textarea
            name="generalComments"
            rows={3}
            placeholder="Weather, access, anything unusual…"
            className="field-input min-h-[6rem]"
          />
        </label>

        <button type="submit" className="btn-primary">
          Continue — save draft & add defects
        </button>
      </form>
    </div>
  );
}
