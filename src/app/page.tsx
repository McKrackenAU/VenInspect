import Link from "next/link";
import { formatAppDate } from "@/lib/date-time";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { computeLevelSchedule, formatLevel } from "@/lib/inspection";
import { StatusPill } from "@/components/StatusPill";
import { InstallHint } from "@/components/InstallHint";
import { DeleteDraftButton } from "@/components/DeleteDraftButton";
import { greetingForNow } from "@/lib/date-time";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
  const hello = greetingForNow(fullUser?.firstName, user.name);
  const [
    assetCount,
    pendingCount,
    attentionAssets,
    scheduleRows,
    myDrafts,
    myAssignments,
  ] =
    await Promise.all([
      prisma.asset.count(),
      prisma.inspection.count({
        where: { status: "PENDING_APPROVAL", deletedAt: null },
      }),
      prisma.asset.findMany({
        select: {
          id: true,
          assetNumber: true,
          name: true,
          roadName: true,
          level1IntervalYears: true,
          level2IntervalYears: true,
          lastLevel1At: true,
          lastLevel2At: true,
        },
        orderBy: { roadName: "asc" },
        take: 80,
      }),
      prisma.inspection.findMany({
        where: {
          status: { in: ["APPROVED", "SUBMITTED", "PENDING_APPROVAL"] },
          deletedAt: null,
        },
        select: {
          assetId: true,
          level: true,
          status: true,
          inspectedAt: true,
          approvedAt: true,
        },
        orderBy: { inspectedAt: "desc" },
        take: 500,
      }),
      prisma.inspection.findMany({
        where: { createdById: user.id, status: "DRAFT", deletedAt: null },
        include: { asset: true },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
      prisma.auditAssignment.findMany({
        where: {
          assignedToId: user.id,
          status: { notIn: ["DONE", "CANCELLED"] },
        },
        include: { asset: true },
        orderBy: { dueDate: "asc" },
        take: 8,
      }),
    ]);

  const byAsset = new Map<string, typeof scheduleRows>();
  for (const row of scheduleRows) {
    const list = byAsset.get(row.assetId);
    if (list) list.push(row);
    else byAsset.set(row.assetId, [row]);
  }

  const attention = attentionAssets
    .flatMap((asset) => {
      const inspections = byAsset.get(asset.id) ?? [];
      const l1 = computeLevelSchedule(asset, inspections, "LEVEL_1");
      const l2 = computeLevelSchedule(asset, inspections, "LEVEL_2");
      return [
        { asset, schedule: l1 },
        { asset, schedule: l2 },
      ];
    })
    .filter((s) => s.schedule.status === "overdue" || s.schedule.status === "due_soon")
    .slice(0, 6);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const todaysAssignments = myAssignments.filter(
    (a) => a.dueDate <= endOfToday,
  );
  const upcomingAssignments = myAssignments.filter(
    (a) => a.dueDate > endOfToday,
  );

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--ventia-green)] sm:text-3xl">
          {hello}
        </h1>
        <p className="text-base text-[color:var(--ventia-muted)]">
          Below are your assigned inspections for today. Tap Start to open one.
        </p>
      </section>

      <InstallHint />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Assigned for today</h2>
        {todaysAssignments.length === 0 ? (
          <p className="card px-4 py-4 text-sm text-[color:var(--ventia-muted)]">
            No inspections due today
            {upcomingAssignments.length > 0
              ? ` — ${upcomingAssignments.length} upcoming on your schedule.`
              : "."}
          </p>
        ) : (
          <ul className="card divide-y divide-[color:var(--ventia-border)] overflow-hidden">
            {todaysAssignments.map((assignment) => {
              const overdue = assignment.dueDate < startOfToday;
              return (
                <li key={assignment.id}>
                  <Link
                    href={`/inspect?assetId=${assignment.assetId}&level=${encodeURIComponent(assignment.level)}`}
                    className="flex min-h-[3.5rem] items-center justify-between gap-3 px-4 py-3 active:bg-[color:var(--ventia-green-tint)]"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[color:var(--ventia-green)]">
                        {assignment.asset.assetNumber} ·{" "}
                        {formatLevel(assignment.level)}
                      </p>
                      <p className="text-sm text-[color:var(--ventia-muted)]">
                        {assignment.asset.roadName} ·{" "}
                        {assignment.asset.name}
                        {" · "}
                        {overdue ? "overdue " : "due "}
                        {formatAppDate(assignment.dueDate, "date")}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-[color:var(--ventia-green)] px-3 py-1.5 text-sm font-semibold text-white">
                      Start
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {upcomingAssignments.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Upcoming</h2>
          <ul className="card divide-y divide-[color:var(--ventia-border)] overflow-hidden">
            {upcomingAssignments.map((assignment) => (
              <li key={assignment.id}>
                <Link
                  href={`/inspect?assetId=${assignment.assetId}&level=${encodeURIComponent(assignment.level)}`}
                  className="flex min-h-[3.5rem] items-center justify-between gap-3 px-4 py-3 active:bg-[color:var(--ventia-green-tint)]"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[color:var(--ventia-green)]">
                      {assignment.asset.assetNumber} ·{" "}
                      {formatLevel(assignment.level)}
                    </p>
                    <p className="text-sm text-[color:var(--ventia-muted)]">
                      {assignment.asset.roadName} · due{" "}
                      {formatAppDate(assignment.dueDate, "date")}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-[color:var(--ventia-blue)]">
                    Start
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {myDrafts.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Your drafts</h2>
          <ul className="card divide-y divide-[color:var(--ventia-border)] overflow-hidden">
            {myDrafts.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-2 px-4 py-3"
              >
                <Link
                  href={`/inspections/${d.id}`}
                  className="min-w-0 flex-1 flex-col justify-center active:bg-[color:var(--ventia-green-tint)]"
                >
                  <span className="block font-semibold text-[color:var(--ventia-green)]">
                    {d.asset.assetNumber} · continue draft
                  </span>
                  <span className="block text-xs text-[color:var(--ventia-muted)]">
                    {d.titleLabel}
                  </span>
                </Link>
                <DeleteDraftButton inspectionId={d.id} next="/" label="Delete" />
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
        <Link href="/reports" className="btn-secondary w-full">
          Submitted reports
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
                        ? ` · due ${formatAppDate(schedule.nextDueAt, "date")}`
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
