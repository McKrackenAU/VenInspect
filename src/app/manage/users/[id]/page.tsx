import Link from "next/link";
import { notFound } from "next/navigation";
import { formatAppDate } from "@/lib/date-time";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatLevel, formatStatus } from "@/lib/inspection";

export const dynamic = "force-dynamic";

export default async function ManageUserHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; level?: string; q?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const statusFilter = (sp.status ?? "ALL").toUpperCase();
  const levelFilter = (sp.level ?? "ALL").toUpperCase();
  const q = (sp.q ?? "").trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      inspectionsCreated: {
        include: { asset: true, defects: true },
        orderBy: { submittedAt: "desc" },
        take: 300,
      },
      inspectionsApproved: {
        include: { asset: true, createdBy: true, defects: true },
        orderBy: { approvedAt: "desc" },
        take: 100,
      },
      auditsAssigned: {
        include: { asset: true },
        orderBy: { dueDate: "desc" },
        take: 50,
      },
    },
  });
  if (!user) notFound();

  let created = user.inspectionsCreated;
  if (statusFilter === "APPROVED") {
    created = created.filter((i) => i.status === "APPROVED" || i.status === "SUBMITTED");
  } else if (statusFilter === "PENDING") {
    created = created.filter((i) => i.status === "PENDING_APPROVAL");
  } else if (statusFilter === "DRAFT") {
    created = created.filter((i) => i.status === "DRAFT" || i.status === "REJECTED");
  }
  if (levelFilter !== "ALL") {
    created = created.filter((i) => i.level === levelFilter);
  }
  if (q) {
    created = created.filter(
      (i) =>
        i.asset.assetNumber.toLowerCase().includes(q) ||
        i.asset.roadName.toLowerCase().includes(q) ||
        i.titleLabel.toLowerCase().includes(q),
    );
  }

  const counts = {
    draft: user.inspectionsCreated.filter(
      (i) => i.status === "DRAFT" || i.status === "REJECTED",
    ).length,
    pending: user.inspectionsCreated.filter((i) => i.status === "PENDING_APPROVAL")
      .length,
    approved: user.inspectionsCreated.filter(
      (i) => i.status === "APPROVED" || i.status === "SUBMITTED",
    ).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-[color:var(--ventia-muted)]">
          <Link href="/manage/users" className="hover:underline">
            People
          </Link>{" "}
          / history
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[color:var(--ventia-green)]">
          {user.name}
        </h1>
        <p className="text-sm text-[color:var(--ventia-muted)]">
          {user.username ? `${user.username} · ` : ""}
          {user.email} · {user.role}
          {user.level1Qualified ? " · L1" : ""}
          {user.level2Qualified ? " · L2" : ""}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-[color:var(--ventia-muted)]">Drafts</p>
          <p className="text-2xl font-semibold">{counts.draft}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[color:var(--ventia-muted)]">Pending</p>
          <p className="text-2xl font-semibold">{counts.pending}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[color:var(--ventia-muted)]">Submitted / approved</p>
          <p className="text-2xl font-semibold">{counts.approved}</p>
        </div>
      </div>

      <form className="card flex flex-wrap gap-2 p-4" method="get">
        <select name="status" defaultValue={statusFilter} className="field-input max-w-[10rem]">
          <option value="ALL">All statuses</option>
          <option value="APPROVED">Reports</option>
          <option value="PENDING">Pending</option>
          <option value="DRAFT">Drafts</option>
        </select>
        <select name="level" defaultValue={levelFilter} className="field-input max-w-[10rem]">
          <option value="ALL">All levels</option>
          <option value="LEVEL_1">Level 1</option>
          <option value="LEVEL_2">Level 2</option>
        </select>
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search asset / road"
          className="field-input min-w-[12rem] flex-1"
        />
        <button type="submit" className="btn-primary text-sm">
          Filter
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Inspections created</h2>
        {created.length === 0 ? (
          <p className="text-sm text-[color:var(--ventia-muted)]">No matching inspections.</p>
        ) : (
          <ul className="divide-y divide-[color:var(--ventia-border)] overflow-hidden rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)]">
            {created.map((insp) => {
              const isReport =
                insp.status !== "DRAFT" && insp.status !== "REJECTED";
              return (
                <li key={insp.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[color:var(--ventia-green)]">
                      {insp.titleLabel}
                    </p>
                    <p className="text-xs text-[color:var(--ventia-muted)]">
                      {insp.asset.assetNumber} · {formatLevel(insp.level)} ·{" "}
                      {formatStatus(insp.status)} ·{" "}
                      {formatAppDate(insp.submittedAt, "datetime")} ·{" "}
                      {insp.defects.length} defects
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    {isReport ? (
                      <>
                        <Link
                          href={`/inspections/${insp.id}/report`}
                          className="text-[color:var(--ventia-blue)] hover:underline"
                        >
                          Open report
                        </Link>
                        <a
                          href={`/api/inspections/${insp.id}/pdf`}
                          className="text-[color:var(--ventia-blue)] hover:underline"
                        >
                          PDF
                        </a>
                        <Link
                          href={`/inspections/${insp.id}/client-export`}
                          className="text-[color:var(--ventia-blue)] hover:underline"
                        >
                          Client Export
                        </Link>
                      </>
                    ) : (
                      <Link
                        href={`/inspections/${insp.id}`}
                        className="text-[color:var(--ventia-blue)] hover:underline"
                      >
                        Open draft
                      </Link>
                    )}
                    <Link
                      href={`/manage/assets/${insp.assetId}`}
                      className="text-[color:var(--ventia-muted)] hover:underline"
                    >
                      Asset
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Approvals by this user</h2>
        {user.inspectionsApproved.length === 0 ? (
          <p className="text-sm text-[color:var(--ventia-muted)]">None yet.</p>
        ) : (
          <ul className="divide-y divide-[color:var(--ventia-border)] overflow-hidden rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)]">
            {user.inspectionsApproved.map((insp) => (
              <li key={insp.id} className="px-4 py-3">
                <Link
                  href={`/inspections/${insp.id}/report`}
                  className="font-medium text-[color:var(--ventia-green)] hover:underline"
                >
                  {insp.titleLabel}
                </Link>
                <p className="text-xs text-[color:var(--ventia-muted)]">
                  {insp.asset.assetNumber} · by {insp.createdBy.name} ·{" "}
                  {insp.approvedAt
                    ? formatAppDate(insp.approvedAt, "date")
                    : "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Assigned audits</h2>
        {user.auditsAssigned.length === 0 ? (
          <p className="text-sm text-[color:var(--ventia-muted)]">None.</p>
        ) : (
          <ul className="divide-y divide-[color:var(--ventia-border)] overflow-hidden rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)]">
            {user.auditsAssigned.map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm">
                {a.asset.assetNumber} · {formatLevel(a.level)} · due{" "}
                {formatAppDate(a.dueDate, "date")} · {a.status}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
