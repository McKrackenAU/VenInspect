import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { inspectionVisibilityWhere } from "@/lib/inspection-access";
import {
  computeLevelSchedule,
  formatAssetType,
  formatLevel,
  formatStatus,
} from "@/lib/inspection";
import { StatusPill } from "@/components/StatusPill";
import { combineInspectionsAsParent } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      inspections: {
        where: inspectionVisibilityWhere(user),
        include: { createdBy: true, defects: true, children: true, parent: true },
        orderBy: { submittedAt: "desc" },
      },
    },
  });
  if (!asset) notFound();

  const l1 = computeLevelSchedule(asset, asset.inspections, "LEVEL_1");
  const l2 = computeLevelSchedule(asset, asset.inspections, "LEVEL_2");
  const standalones = asset.inspections.filter((i) => i.relationKind !== "CHILD");
  const myDrafts = asset.inspections.filter(
    (i) => i.status === "DRAFT" && i.createdById === user.id,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[color:var(--ventia-muted)]">
            <Link href="/assets" className="hover:text-[color:var(--ventia-blue)]">
              Assets
            </Link>{" "}
            / {asset.roadName} / {asset.assetNumber}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[color:var(--ventia-green)]">
            {asset.name}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
            {formatAssetType(asset.type)} · {asset.roadName}
            {asset.location ? ` · ${asset.location}` : ""}
          </p>
        </div>
        <Link
          href={`/inspect?assetId=${asset.id}`}
          className="rounded-md bg-[color:var(--ventia-green)] px-3 py-2 text-sm font-medium text-white"
        >
          New inspection
        </Link>
      </div>

      {myDrafts.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <h2 className="font-semibold text-amber-900 dark:text-amber-100">Your drafts on this asset</h2>
          <ul className="mt-2 space-y-1">
            {myDrafts.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/inspections/${d.id}`}
                  className="text-sm font-medium text-[color:var(--ventia-green)] hover:underline"
                >
                  Continue: {d.titleLabel}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <ScheduleCard title="Level 1" interval={asset.level1IntervalYears} schedule={l1} />
        <ScheduleCard title="Level 2" interval={asset.level2IntervalYears} schedule={l2} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Previous reports</h2>
        <p className="text-xs text-[color:var(--ventia-muted)]">
          Drafts are only visible to the inspector who created them and to admins.
          Submitted reports stay here so you can reopen history and carry defects forward.
        </p>
        {asset.inspections.length === 0 ? (
          <p className="text-sm text-[color:var(--ventia-muted)]">No inspections yet.</p>
        ) : (
          <ul className="divide-y divide-[color:var(--ventia-border)] overflow-hidden rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)]">
            {asset.inspections.map((insp) => (
              <li
                key={insp.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <Link
                    href={`/inspections/${insp.id}`}
                    className="font-medium text-[color:var(--ventia-green)] hover:underline"
                  >
                    {insp.titleLabel}
                    {insp.status === "DRAFT" ? " (draft)" : ""}
                  </Link>
                  <p className="text-xs text-[color:var(--ventia-muted)]">
                    {formatLevel(insp.level)} · {formatStatus(insp.status)} ·{" "}
                    {format(insp.submittedAt, "dd MMM yyyy HH:mm")} · by{" "}
                    {insp.createdBy.name} · {insp.defects.length} defect
                    {insp.defects.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {insp.status !== "DRAFT" ? (
                    <>
                      <Link
                        href={`/inspections/${insp.id}/report`}
                        className="text-[color:var(--ventia-blue)] hover:underline"
                      >
                        Full report
                      </Link>
                      <Link
                        href={`/inspections/${insp.id}/scope`}
                        className="text-[color:var(--ventia-blue)] hover:underline"
                      >
                        Scope export
                      </Link>
                    </>
                  ) : (
                    <Link
                      href={`/inspections/${insp.id}`}
                      className="text-[color:var(--ventia-blue)] hover:underline"
                    >
                      Continue draft
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {standalones.filter((i) => i.status !== "DRAFT").length >= 2 && (
        <section className="rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-5">
          <h2 className="font-medium">Combine two reports</h2>
          <p className="mt-1 text-xs text-[color:var(--ventia-muted)]">
            Creates a parent inspection and links both as children.
          </p>
          <form action={combineInspectionsAsParent} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="assetId" value={asset.id} />
            <select
              name="inspectionA"
              required
              className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                First report…
              </option>
              {standalones
                .filter((i) => i.status !== "DRAFT")
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.titleLabel}
                  </option>
                ))}
            </select>
            <select
              name="inspectionB"
              required
              className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Second report…
              </option>
              {standalones
                .filter((i) => i.status !== "DRAFT")
                .map((i) => (
                  <option key={`b-${i.id}`} value={i.id}>
                    {i.titleLabel}
                  </option>
                ))}
            </select>
            <button
              type="submit"
              className="sm:col-span-2 rounded-md bg-[color:var(--ventia-blue)] px-4 py-2 text-sm font-semibold text-white"
            >
              Create parent + link children
            </button>
          </form>
        </section>
      )}
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
    <div className="rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{title}</h3>
        <StatusPill status={schedule.status} />
      </div>
      <p className="mt-2 text-sm text-[color:var(--ventia-muted)]">Every {interval} years</p>
      <p className="mt-1 text-sm">
        Last:{" "}
        {schedule.lastInspectedAt
          ? format(schedule.lastInspectedAt, "dd MMM yyyy")
          : "None"}
      </p>
      <p className="text-sm">
        Next due:{" "}
        {schedule.nextDueAt ? format(schedule.nextDueAt, "dd MMM yyyy") : "—"}
      </p>
    </div>
  );
}
