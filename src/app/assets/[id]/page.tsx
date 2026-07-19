import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { computeLevelSchedule, formatLevel, formatStatus } from "@/lib/inspection";
import { StatusPill } from "@/components/StatusPill";

export const dynamic = "force-dynamic";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      inspections: {
        include: { createdBy: true, defects: true },
        orderBy: { inspectedAt: "desc" },
      },
    },
  });
  if (!asset) notFound();

  const l1 = computeLevelSchedule(asset, asset.inspections, "LEVEL_1");
  const l2 = computeLevelSchedule(asset, asset.inspections, "LEVEL_2");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">
            <Link href="/assets" className="hover:text-teal-300">
              Assets
            </Link>{" "}
            / {asset.assetNumber}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-white">{asset.name}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {asset.type} · {asset.roadName ?? "—"} · {asset.location ?? "—"}
          </p>
        </div>
        <Link
          href={`/inspect?assetId=${asset.id}`}
          className="rounded-md bg-teal-600/90 px-3 py-2 text-sm font-medium text-white hover:bg-teal-500"
        >
          New inspection
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <ScheduleCard title="Level 1" interval={asset.level1IntervalYears} schedule={l1} />
        <ScheduleCard title="Level 2" interval={asset.level2IntervalYears} schedule={l2} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">Previous reports</h2>
        {asset.inspections.length === 0 ? (
          <p className="text-sm text-slate-400">No inspections yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
            {asset.inspections.map((insp) => (
              <li key={insp.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <Link
                    href={`/inspections/${insp.id}`}
                    className="font-medium text-teal-200 hover:underline"
                  >
                    {formatLevel(insp.level)} · {format(insp.inspectedAt, "dd MMM yyyy")}
                  </Link>
                  <p className="text-xs text-slate-400">
                    {formatStatus(insp.status)} · by {insp.createdBy.name} ·{" "}
                    {insp.defects.length} defect{insp.defects.length === 1 ? "" : "s"}
                  </p>
                </div>
                <Link
                  href={`/inspections/${insp.id}/report`}
                  className="text-xs text-slate-300 hover:text-teal-300"
                >
                  Report view
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ScheduleCard({
  title,
  interval,
  schedule,
}: {
  title: string;
  interval: number;
  schedule: ReturnType<typeof computeLevelSchedule>;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-white">{title}</h3>
        <StatusPill status={schedule.status} />
      </div>
      <p className="mt-2 text-sm text-slate-400">Every {interval} years</p>
      <p className="mt-1 text-sm text-slate-300">
        Last:{" "}
        {schedule.lastInspectedAt
          ? format(schedule.lastInspectedAt, "dd MMM yyyy")
          : "None"}
      </p>
      <p className="text-sm text-slate-300">
        Next due:{" "}
        {schedule.nextDueAt ? format(schedule.nextDueAt, "dd MMM yyyy") : "—"}
      </p>
    </div>
  );
}
