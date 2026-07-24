"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DASHBOARD_RANGES,
  formatDashDay,
  formatDashWhen,
  type DashboardPayload,
  type DashboardRange,
} from "@/lib/admin-dashboard-shared";

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

const REFRESH_MS = 30_000;

export function AdminLiveDashboard({
  initial,
}: {
  initial: DashboardPayload;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [range, setRange] = useState<DashboardRange>(initial.range);
  const [live, setLive] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assignPending, startAssign] = useTransition();
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  const refresh = useCallback(async (nextRange: DashboardRange) => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/manage/dashboard?range=${nextRange}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Refresh failed");
      const json = (await res.json()) as DashboardPayload;
      setData(json);
    } catch {
      /* keep last good snapshot */
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      void refresh(range);
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [live, range, refresh]);

  function onRangeChange(value: DashboardRange) {
    setRange(value);
    void refresh(value);
  }

  function assignOverdue(opts: {
    assetId: string;
    level: string;
    dueDate: string;
    assignedToId: string;
    existingAssignmentId: string | null;
  }) {
    setAssignMsg(null);
    startAssign(async () => {
      try {
        const res = await fetch("/api/manage/assign-overdue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(opts),
        });
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (!res.ok) throw new Error(body?.error || "Assign failed");
        setAssignMsg("Assigned — inspector notified.");
        await refresh(range);
        router.refresh();
      } catch (e) {
        setAssignMsg(e instanceof Error ? e.message : "Assign failed");
      }
    });
  }

  const s = data.stats;
  const maxAuditor = Math.max(1, ...s.byAuditor.map((a) => a.count));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
            Live operations
          </h1>
          <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
            Tracking window: {data.rangeLabel}.{" "}
            {live ? "Auto-refreshes every 30s." : "Live refresh paused."} Updated{" "}
            {formatDashWhen(data.generatedAt)}
            {refreshing ? " · refreshing…" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-[color:var(--ventia-muted)]">Period</span>
            <select
              className="field-input"
              value={range}
              onChange={(e) => onRangeChange(e.target.value as DashboardRange)}
            >
              {DASHBOARD_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-2 text-xs font-semibold"
            onClick={() => setLive((v) => !v)}
          >
            {live ? "Pause live" : "Resume live"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-[color:var(--ventia-green)] px-3 py-2 text-xs font-semibold text-[color:var(--ventia-green)]"
            onClick={() => void refresh(range)}
          >
            Refresh now
          </button>
        </div>
      </div>

      {assignMsg ? (
        <p className="rounded-lg border border-[color:var(--ventia-border)] bg-[color:var(--ventia-green-tint)] px-3 py-2 text-sm">
          {assignMsg}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Completed in period"
          value={s.completedInRange}
          hint={`${s.submittedInRange} submitted · ${s.approvedInRange} approved`}
        />
        <Kpi label="Pending approval" value={s.pendingApproval} hint="Awaiting L2 sign-off" />
        <Kpi label="Drafts open" value={s.draftsOpen} hint="Currently being worked" />
        <Kpi
          label="Overdue / due soon"
          value={s.overdueAssets}
          hint={`${s.dueSoonAssets} due within ~90 days`}
          accent={s.overdueAssets > 0 ? "danger" : "ok"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3 2xl:grid-cols-4">
        <div className="card space-y-3 p-4 lg:col-span-1">
          <h2 className="text-sm font-semibold text-[color:var(--ventia-green)]">
            By inspection type
          </h2>
          {s.byLevel.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-2 text-sm">
              {s.byLevel.map((row) => (
                <li key={row.level} className="flex justify-between gap-2">
                  <span>{row.label}</span>
                  <span className="font-mono font-semibold">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
          <h2 className="pt-2 text-sm font-semibold text-[color:var(--ventia-green)]">
            By asset type
          </h2>
          {s.byAssetType.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-2 text-sm">
              {s.byAssetType.map((row) => (
                <li key={row.type} className="flex justify-between gap-2">
                  <span>{row.label}</span>
                  <span className="font-mono font-semibold">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card space-y-3 p-4 lg:col-span-2 2xl:col-span-3">
          <h2 className="text-sm font-semibold text-[color:var(--ventia-green)]">
            Throughput by auditor
          </h2>
          {s.byAuditor.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-2">
              {s.byAuditor.map((row) => (
                <li key={row.userId} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <Link
                      href={`/manage/users/${row.userId}`}
                      className="font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                    <span className="font-mono text-[color:var(--ventia-muted)]">
                      {row.count}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[color:var(--ventia-border)]">
                    <div
                      className="h-full rounded-full bg-[color:var(--ventia-green-mid)]"
                      style={{ width: `${(row.count / maxAuditor) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-2">
        <FeedCard title="Recently submitted">
          {data.recentlySubmitted.length === 0 ? (
            <Empty />
          ) : (
            <ul className="divide-y divide-[color:var(--ventia-border)]">
              {data.recentlySubmitted.map((row) => (
                <li key={row.id} className="flex flex-wrap items-start gap-2 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/inspections/${row.id}/report`}
                      className="font-medium text-[color:var(--ventia-green)] hover:underline"
                    >
                      {row.assetNumber}
                    </Link>
                    <p className="text-xs text-[color:var(--ventia-muted)]">
                      {row.levelLabel} · {formatStatus(row.status)} ·{" "}
                      {row.auditorName} · {row.defectCount} defects
                    </p>
                    <p className="text-[11px] text-[color:var(--ventia-muted)]">
                      {row.roadName} · {formatDashWhen(row.at)}
                    </p>
                  </div>
                  <Link
                    href={`/api/inspections/${row.id}/client-export`}
                    className="text-xs font-semibold text-[color:var(--ventia-blue)]"
                  >
                    Export
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </FeedCard>

        <FeedCard title="Currently being worked on">
          {data.inProgress.length === 0 ? (
            <Empty />
          ) : (
            <ul className="divide-y divide-[color:var(--ventia-border)]">
              {data.inProgress.map((row) => (
                <li key={row.id} className="py-3">
                  <Link
                    href={`/inspections/${row.id}`}
                    className="font-medium text-[color:var(--ventia-green)] hover:underline"
                  >
                    {row.assetNumber}
                  </Link>
                  <p className="text-xs text-[color:var(--ventia-muted)]">
                    {row.levelLabel} · {formatStatus(row.status)} · auditor{" "}
                    <strong className="text-[color:var(--ventia-ink)]">
                      {row.auditorName}
                    </strong>
                  </p>
                  <p className="text-[11px] text-[color:var(--ventia-muted)]">
                    {row.roadName} · updated {formatDashWhen(row.updatedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </FeedCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <FeedCard title="Due soon">
          {data.dueSoon.length === 0 ? (
            <Empty text="Nothing due in the next ~90 days." />
          ) : (
            <ul className="divide-y divide-[color:var(--ventia-border)]">
              {data.dueSoon.map((row) => (
                <li
                  key={`${row.assetId}-${row.level}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div>
                    <Link
                      href={`/manage/assets/${row.assetId}`}
                      className="font-medium hover:underline"
                    >
                      {row.assetNumber}
                    </Link>
                    <p className="text-xs text-[color:var(--ventia-muted)]">
                      {row.levelLabel} · due {formatDashDay(row.nextDueAt)} (
                      {row.daysUntilDue}d)
                    </p>
                  </div>
                  <Link
                    href={`/assets/${row.assetId}`}
                    className="text-xs font-semibold text-[color:var(--ventia-blue)]"
                  >
                    Open asset
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </FeedCard>

        <FeedCard
          title="Overdue"
          badge={
            data.overdue.length > 0
              ? `${data.overdue.length} need attention`
              : undefined
          }
        >
          {data.overdue.length === 0 ? (
            <Empty text="No overdue Level 1 / Level 2 assets." />
          ) : (
            <ul className="divide-y divide-[color:var(--ventia-border)]">
              {data.overdue.map((row) => (
                <li key={`${row.assetId}-${row.level}`} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {row.assetNumber}{" "}
                        <span className="text-xs font-normal text-rose-600 dark:text-rose-400">
                          {row.daysOverdue}d overdue
                        </span>
                      </p>
                      <p className="text-xs text-[color:var(--ventia-muted)]">
                        {row.roadName} · {row.levelLabel} · was due{" "}
                        {formatDashDay(row.nextDueAt)}
                        {row.existingAssigneeName
                          ? ` · assigned to ${row.existingAssigneeName}`
                          : ""}
                      </p>
                    </div>
                    <Link
                      href={`/manage/assets/${row.assetId}`}
                      className="text-xs font-semibold text-[color:var(--ventia-blue)]"
                    >
                      Asset
                    </Link>
                  </div>
                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const assignedToId = String(fd.get("assignedToId") ?? "");
                      if (!assignedToId) return;
                      assignOverdue({
                        assetId: row.assetId,
                        level: row.level,
                        dueDate: new Date().toISOString(),
                        assignedToId,
                        existingAssignmentId: row.existingAssignmentId,
                      });
                    }}
                  >
                    <select
                      name="assignedToId"
                      required
                      defaultValue=""
                      className="field-input min-w-[10rem] flex-1 text-sm"
                    >
                      <option value="" disabled>
                        Assign inspector…
                      </option>
                      {data.inspectors.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={assignPending}
                      className="rounded-lg bg-[color:var(--ventia-green)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {row.existingAssignmentId ? "Reassign" : "Push / assign"}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </FeedCard>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  accent = "ok",
}: {
  label: string;
  value: number;
  hint?: string;
  accent?: "ok" | "danger";
}) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-[color:var(--ventia-muted)]">
        {label}
      </p>
      <p
        className={`mt-1 text-3xl font-semibold ${
          accent === "danger"
            ? "text-rose-600 dark:text-rose-400"
            : "text-[color:var(--ventia-green)]"
        }`}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-[color:var(--ventia-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

function FeedCard({
  title,
  children,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-[color:var(--ventia-border)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[color:var(--ventia-green)]">
          {title}
        </h2>
        {badge ? (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="max-h-[min(36rem,55dvh)] overflow-y-auto px-4 lg:max-h-[min(40rem,60dvh)]">
        {children}
      </div>
    </section>
  );
}

function Empty({ text = "Nothing in this window." }: { text?: string }) {
  return <p className="py-6 text-sm text-[color:var(--ventia-muted)]">{text}</p>;
}
