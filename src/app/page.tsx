import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { computeLevelSchedule, formatLevel } from "@/lib/inspection";
import { StatusPill } from "@/components/StatusPill";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [assets, pending, notifications] = await Promise.all([
    prisma.asset.findMany({
      include: { inspections: true },
      orderBy: { assetNumber: "asc" },
    }),
    prisma.inspection.findMany({
      where: { status: "PENDING_APPROVAL" },
      include: { asset: true, createdBy: true },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.notification.findMany({
      where: { read: false },
      include: { inspection: { include: { asset: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const schedules = assets.flatMap((asset) => {
    const l1 = computeLevelSchedule(asset, asset.inspections, "LEVEL_1");
    const l2 = computeLevelSchedule(asset, asset.inspections, "LEVEL_2");
    return [
      { asset, schedule: l1 },
      { asset, schedule: l2 },
    ];
  });

  const attention = schedules.filter(
    (s) => s.schedule.status === "overdue" || s.schedule.status === "due_soon",
  );

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Dashboard</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Track bridge and drainage assets, run Level 1 / Level 2 inspections on site,
          and manage approvals. PDF-style reports can be generated from each completed
          inspection.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Assets" value={String(assets.length)} href="/assets" />
        <Stat label="Pending L2 approvals" value={String(pending.length)} href="/approvals" />
        <Stat label="Unread notifications" value={String(notifications.length)} href="/approvals" />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">Due / overdue</h2>
          <Link href="/inspect" className="text-sm text-teal-300 hover:underline">
            Start inspection →
          </Link>
        </div>
        {attention.length === 0 ? (
          <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-6 text-sm text-slate-400">
            Nothing flagged. Level 1 is every 3 years; Level 2 every 5 years by default.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60">
            {attention.map(({ asset, schedule }) => (
              <li key={`${asset.id}-${schedule.level}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <Link href={`/assets/${asset.id}`} className="font-medium text-teal-200 hover:underline">
                    {asset.assetNumber} — {asset.name}
                  </Link>
                  <p className="text-xs text-slate-400">
                    {formatLevel(schedule.level)} · next due{" "}
                    {schedule.nextDueAt ? format(schedule.nextDueAt, "dd MMM yyyy") : "—"}
                  </p>
                </div>
                <StatusPill status={schedule.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">Notifications</h2>
        {notifications.length === 0 ? (
          <p className="text-sm text-slate-400">No unread notifications.</p>
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => (
              <li key={n.id} className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
                <p className="text-sm font-medium text-slate-100">{n.title}</p>
                <p className="mt-0.5 text-sm text-slate-400">{n.message}</p>
                {n.inspectionId && (
                  <Link
                    href={`/inspections/${n.inspectionId}`}
                    className="mt-2 inline-block text-xs text-teal-300 hover:underline"
                  >
                    Open inspection
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-4 transition hover:border-teal-700/50"
    >
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-white">{value}</p>
    </Link>
  );
}
