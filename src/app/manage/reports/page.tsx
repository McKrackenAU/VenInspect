import Link from "next/link";
import { formatAppDate } from "@/lib/date-time";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatLevel, formatStatus } from "@/lib/inspection";
import {
  ReportsAdminTable,
  type ReportAdminRow,
} from "@/components/ReportsAdminTable";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    level?: string;
    scope?: string; // active | trash | all
  }>;
};

export default async function ManageReportsPage({ searchParams }: Props) {
  await requireAdmin();
  const { q, status, level, scope: scopeRaw } = await searchParams;
  const scope =
    scopeRaw === "trash" || scopeRaw === "all" || scopeRaw === "active"
      ? scopeRaw
      : "active";

  const where = {
    AND: [
      scope === "active"
        ? { deletedAt: null }
        : scope === "trash"
          ? { deletedAt: { not: null } }
          : {},
      status ? { status: status as "DRAFT" | "SUBMITTED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" } : {},
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

  const [inspections, levels, totalActive, totalTrash] = await Promise.all([
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
      distinct: ["level"],
      select: { level: true },
      orderBy: { level: "asc" },
    }),
    prisma.inspection.count({ where: { deletedAt: null } }),
    prisma.inspection.count({ where: { deletedAt: { not: null } } }),
  ]);

  const rows: ReportAdminRow[] = inspections.map((i) => ({
    id: i.id,
    titleLabel: i.titleLabel,
    statusLabel: formatStatus(i.status),
    levelLabel: formatLevel(i.level),
    inspectedLabel: formatAppDate(i.inspectedAt, "date"),
    assetNumber: i.asset.assetNumber,
    roadName: i.asset.roadName || "Unknown Road",
    inspectorName: i.createdBy.name,
    inTrash: Boolean(i.deletedAt),
    openHref: `/inspections/${i.id}`,
    exportHref: `/api/inspections/${i.id}/client-export`,
    manageAssetHref: `/manage/assets/${i.asset.id}`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
            Reports
          </h1>
          <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
            Full inspection list for cleanup and bulk client exports.{" "}
            {totalActive} active · {totalTrash} in{" "}
            <Link href="/manage/trash" className="font-semibold underline">
              Trash
            </Link>
            .
          </p>
        </div>
      </div>

      <form className="flex flex-wrap gap-2 rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search title, asset, road, inspector…"
          className="min-w-[14rem] flex-1 rounded-md border border-[color:var(--ventia-border)] bg-transparent px-3 py-2 text-sm"
        />
        <select
          name="scope"
          defaultValue={scope}
          className="rounded-md border border-[color:var(--ventia-border)] bg-transparent px-3 py-2 text-sm"
        >
          <option value="active">Active only</option>
          <option value="trash">Trash only</option>
          <option value="all">Active + Trash</option>
        </select>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-md border border-[color:var(--ventia-border)] bg-transparent px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="PENDING_APPROVAL">Pending approval</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
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

      <ReportsAdminTable rows={rows} />
    </div>
  );
}
