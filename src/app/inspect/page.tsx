import Link from "next/link";
import { prisma } from "@/lib/db";
import { createInspection } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function InspectPage({
  searchParams,
}: {
  searchParams: Promise<{ assetId?: string }>;
}) {
  const { assetId: preselect } = await searchParams;
  const assets = await prisma.asset.findMany({ orderBy: { assetNumber: "asc" } });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Start inspection</h1>
        <p className="mt-1 text-sm text-slate-400">
          Field-friendly entry. Level 1 inspectors can draft Level 2 reports — Level 2
          inspectors are notified to verify.
        </p>
      </div>

      <form action={createInspection} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-300">Asset</span>
          <select
            name="assetId"
            required
            defaultValue={preselect ?? ""}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100"
          >
            <option value="" disabled>
              Select asset…
            </option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.assetNumber} — {a.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-300">Inspection level</legend>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="radio" name="level" value="LEVEL_1" defaultChecked className="accent-teal-400" />
            Level 1 (every 3 years)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="radio" name="level" value="LEVEL_2" className="accent-teal-400" />
            Level 2 (every 5 years — may need L2 approval)
          </label>
        </fieldset>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-300">General comments</span>
          <textarea
            name="generalComments"
            rows={3}
            placeholder="Site conditions, weather, access…"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-md bg-teal-600 py-3 text-sm font-semibold text-white hover:bg-teal-500"
        >
          Create & continue on site
        </button>
      </form>

      <p className="text-center text-xs text-slate-500">
        Demo actor: Level 1 inspector (
        <Link href="/admin" className="text-teal-400 hover:underline">
          manage users
        </Link>
        )
      </p>
    </div>
  );
}
