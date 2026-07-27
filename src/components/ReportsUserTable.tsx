"use client";

import Link from "next/link";
import { reopenInspectionForEdit } from "@/lib/actions";

export type ReportUserRow = {
  id: string;
  titleLabel: string;
  statusLabel: string;
  status: string;
  levelLabel: string;
  inspectedLabel: string;
  assetNumber: string;
  roadName: string;
  inspectorName: string;
  viewHref: string;
  /** Direct edit when draft/rejected */
  editHref: string | null;
  /** Reopen submitted/approved/pending for editing */
  canReopen: boolean;
  exportHref: string;
};

export function ReportsUserTable({ rows }: { rows: ReportUserRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[color:var(--ventia-muted)]">
        No reports match these filters.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex flex-wrap items-start gap-3 rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] px-3 py-3"
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium text-[color:var(--ventia-ink)]">
              {r.titleLabel}
            </p>
            <p className="text-xs text-[color:var(--ventia-muted)]">
              {r.roadName} · {r.assetNumber} · {r.levelLabel} · {r.statusLabel} ·{" "}
              {r.inspectedLabel} · {r.inspectorName}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={r.viewHref}
              className="rounded-md border border-[color:var(--ventia-border)] px-2.5 py-1 text-xs font-semibold"
            >
              View
            </Link>
            {r.editHref ? (
              <Link
                href={r.editHref}
                className="rounded-md border border-amber-600/60 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200"
              >
                Edit
              </Link>
            ) : r.canReopen ? (
              <form action={reopenInspectionForEdit}>
                <input type="hidden" name="inspectionId" value={r.id} />
                <button
                  type="submit"
                  className="rounded-md border border-amber-600/60 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200"
                >
                  Edit
                </button>
              </form>
            ) : null}
            <Link
              href={r.exportHref}
              className="rounded-md border border-[color:var(--ventia-green)] px-2.5 py-1 text-xs font-semibold text-[color:var(--ventia-green)]"
            >
              Export
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
