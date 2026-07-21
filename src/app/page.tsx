import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { computeLevelSchedule, formatLevel } from "@/lib/inspection";
import { StatusPill } from "@/components/StatusPill";
import { InstallHint } from "@/components/InstallHint";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const [assetCount, pendingCount, attentionPreview, myDrafts] = await Promise.all([
    prisma.asset.count(),
    prisma.inspection.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.asset.findMany({
      include: { inspections: true },
      orderBy: { roadName: "asc" },
      take: 80,
    }),
    prisma.inspection.findMany({
      where: { createdById: user.id, status: "DRAFT" },
      include: { asset: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
  ]);

  const attention = attentionPreview
    .flatMap((asset) => {
      const l1 = computeLevelSchedule(asset, asset.inspections, "LEVEL_1");
      const l2 = computeLevelSchedule(asset, asset.inspections, "LEVEL_2");
      return [
        { asset, schedule: l1 },
        { asset, schedule: l2 },
      ];
    })
    .filter((s) => s.schedule.status === "overdue" || s.schedule.status === "due_soon")
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--ventia-green)] sm:text-3xl">
          What do you need to do?
        </h1>
        <p className="text-base text-[color:var(--ventia-muted)]">
          Tap a big button. Drafts are saved until you submit.
        </p>
      </section>

      <InstallHint />

      {myDrafts.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Your drafts</h2>
          <ul className="card divide-y divide-[color:var(--ventia-border)] overflow-hidden">
            {myDrafts.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/inspections/${d.id}`}
                  className="flex min-h-[3.25rem] flex-col justify-center px-4 py-3 active:bg-[color:var(--ventia-green-tint)]"
                >
                  <span className="font-semibold text-[color:var(--ventia-green)]">
                    {d.asset.assetNumber} · continue draft
                  </span>
                  <span className="text-xs text-[color:var(--ventia-muted)]">
                    {d.titleLabel}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-3">
        <Link href="/inspect" className="btn-primary text-lg shadow-sm">
          Start an inspection
        </Link>
        <Link href="/map" className="btn-secondary w-full">
          Map · nearby assets
        </Link>
        <Link href="/assets" className="btn-secondary w-full">
          Find an asset
        </Link>
        {pendingCount > 0 && (
          <Link
            href="/approvals"
            className="btn-secondary w-full border-[color:var(--ventia-blue)] text-[color:var(--ventia-blue)]"
          >
            Approvals waiting ({pendingCount})
          </Link>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="card px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--ventia-muted)]">
            Assets
          </p>
          <p className="mt-1 text-3xl font-bold text-[color:var(--ventia-green)]">
            {assetCount}
          </p>
        </div>
        <div className="card px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--ventia-muted)]">
            Need approval
          </p>
          <p className="mt-1 text-3xl font-bold text-[color:var(--ventia-green)]">
            {pendingCount}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Coming due</h2>
        {attention.length === 0 ? (
          <p className="card px-4 py-5 text-sm text-[color:var(--ventia-muted)]">
            Nothing overdue right now.
          </p>
        ) : (
          <ul className="card divide-y divide-[color:var(--ventia-border)] overflow-hidden">
            {attention.map(({ asset, schedule }) => (
              <li key={`${asset.id}-${schedule.level}`}>
                <Link
                  href={`/assets/${asset.id}`}
                  className="flex min-h-[3.5rem] items-center justify-between gap-3 px-4 py-3 active:bg-[color:var(--ventia-green-tint)]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[color:var(--ventia-green)]">
                      {asset.assetNumber}
                    </p>
                    <p className="truncate text-sm text-[color:var(--ventia-muted)]">
                      {asset.roadName} · {formatLevel(schedule.level)}
                      {schedule.nextDueAt
                        ? ` · due ${format(schedule.nextDueAt, "dd MMM yyyy")}`
                        : ""}
                    </p>
                  </div>
                  <StatusPill status={schedule.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
