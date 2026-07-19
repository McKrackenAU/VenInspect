import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { computeLevelSchedule, formatLevel } from "@/lib/inspection";
import { StatusPill } from "@/components/StatusPill";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const assets = await prisma.asset.findMany({
    include: { inspections: true },
    orderBy: { assetNumber: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Assets</h1>
        <p className="mt-1 text-sm text-slate-400">
          Bridges and drainage structures with Level 1 / Level 2 due dates.
        </p>
      </div>

      <ul className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        {assets.map((asset) => {
          const l1 = computeLevelSchedule(asset, asset.inspections, "LEVEL_1");
          const l2 = computeLevelSchedule(asset, asset.inspections, "LEVEL_2");
          return (
            <li key={asset.id} className="px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/assets/${asset.id}`}
                    className="text-lg font-medium text-teal-200 hover:underline"
                  >
                    {asset.assetNumber} — {asset.name}
                  </Link>
                  <p className="mt-0.5 text-sm text-slate-400">
                    {asset.type} · {asset.roadName ?? "—"} ·{" "}
                    {asset.inspections.length} report
                    {asset.inspections.length === 1 ? "" : "s"}
                  </p>
                </div>
                <Link
                  href={`/inspect?assetId=${asset.id}`}
                  className="rounded-md bg-teal-600/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-500"
                >
                  Inspect
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
                <ScheduleRow label={formatLevel("LEVEL_1")} schedule={l1} />
                <ScheduleRow label={formatLevel("LEVEL_2")} schedule={l2} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ScheduleRow({
  label,
  schedule,
}: {
  label: string;
  schedule: ReturnType<typeof computeLevelSchedule>;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-medium text-slate-300">{label}</span>
      <StatusPill status={schedule.status} />
      <span>
        next{" "}
        {schedule.nextDueAt ? format(schedule.nextDueAt, "dd MMM yyyy") : "—"}
      </span>
    </div>
  );
}
