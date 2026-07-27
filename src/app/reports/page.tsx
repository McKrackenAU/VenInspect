import { formatAppDate } from "@/lib/date-time";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  canEditInspection,
  inspectionVisibilityWhere,
} from "@/lib/inspection-access";
import { formatLevel, formatStatus } from "@/lib/inspection";
import {
  ReportsUserTable,
  type ReportUserRow,
} from "@/components/ReportsUserTable";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    level?: string;
  }>;
};

export default async function UserReportsPage({ searchParams }: Props) {
  const user = await requireUser();
  const { q, status, level } = await searchParams;

  const visibility = inspectionVisibilityWhere(user);
  const where = {
    AND: [
      visibility,
      // Default: submitted pipeline (hide drafts unless explicitly filtered)
      status
        ? {
            status: status as
              | "DRAFT"
              | "SUBMITTED"
              | "PENDING_APPROVAL"
              | "APPROVED"
              | "REJECTED",
          }
        : { status: { not: "DRAFT" as const } },
      level ? { level } : {},
      q
        ? {
            OR: [
              { titleLabel: { contains: q } },
              { folderKey: { contains: q } },
              { asset: { assetNumber: { contains: q } } },
              { asset: { roadName: { contains: q } } },
              { asset: { name: { contains: q } } },
              { createdBy: { name: { contains: q } } },
            ],
          }
        : {},
    ],
  };

  const [inspections, levels] = await Promise.all([
    prisma.inspection.findMany({
      where,
      include: {
        asset: { select: { id: true, assetNumber: true, roadName: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: [{ inspectedAt: "desc" }, { createdAt: "desc" }],
      take: 500,
    }),
    prisma.inspection.findMany({
      where: visibility,
      distinct: ["level"],
      select: { level: true },
      orderBy: { level: "asc" },
    }),
  ]);

  const rows: ReportUserRow[] = inspections.map((i) => {
    const editable = canEditInspection(user, i);
    const canReopen =
      !editable &&
      (user.role === "ADMIN" || user.id === i.createdById) &&
      (i.status === "SUBMITTED" ||
        i.status === "APPROVED" ||
        i.status === "PENDING_APPROVAL");
    const isDraft = i.status === "DRAFT";
    return {
      id: i.id,
      titleLabel: i.titleLabel,
      statusLabel: formatStatus(i.status),
      status: i.status,
      levelLabel: formatLevel(i.level),
      inspectedLabel: formatAppDate(i.inspectedAt, "date"),
      assetNumber: i.asset.assetNumber,
      roadName: i.asset.roadName || "Unknown Road",
      inspectorName: i.createdBy.name,
      viewHref: isDraft
        ? `/inspections/${i.id}`
        : `/inspections/${i.id}/report`,
      editHref: editable ? `/inspections/${i.id}` : null,
      canReopen,
      exportHref: `/inspections/${i.id}/client-export`,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
          Reports
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Submitted and approved inspections you can view, edit, or export.
          Drafts stay on Home until submitted.
        </p>
      </div>

      <form className="flex flex-wrap gap-2 rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search title, asset, road, inspector…"
          className="min-w-[14rem] flex-1 rounded-md border border-[color:var(--ventia-border)] bg-transparent px-3 py-2 text-sm"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-md border border-[color:var(--ventia-border)] bg-transparent px-3 py-2 text-sm"
        >
          <option value="">Submitted &amp; later</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="PENDING_APPROVAL">Pending approval</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="DRAFT">My drafts</option>
        </select>
        <select
          name="level"
          defaultValue={level ?? ""}
          className="rounded-md border border-[color:var(--ventia-border)] bg-transparent px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          {levels.map((l) => (
            <option key={l.level} value={l.level}>
              {formatLevel(l.level)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-[color:var(--ventia-green)] px-3 py-2 text-sm font-semibold text-[color:var(--ventia-green)]"
        >
          Filter
        </button>
      </form>

      <p className="text-sm text-[color:var(--ventia-muted)]">
        Showing {rows.length}
        {rows.length >= 500 ? " (capped at 500 — narrow filters)" : ""} report
        {rows.length === 1 ? "" : "s"}
      </p>

      <ReportsUserTable rows={rows} />
    </div>
  );
}
