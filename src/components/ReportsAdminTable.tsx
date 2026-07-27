"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bulkPurgeInspectionsAction,
  bulkTrashInspectionsAction,
} from "@/lib/trash";

export type ReportAdminRow = {
  id: string;
  titleLabel: string;
  statusLabel: string;
  levelLabel: string;
  inspectedLabel: string;
  assetNumber: string;
  roadName: string;
  inspectorName: string;
  inTrash: boolean;
  openHref: string;
  exportHref: string;
  manageAssetHref: string;
};

export function ReportsAdminTable({ rows }: { rows: ReportAdminRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r.id)),
    [rows, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === allIds.length ? new Set() : new Set(allIds),
    );
  }

  function runBulk(kind: "trash" | "purge") {
    setError(null);
    setMessage(null);
    if (!selected.size) {
      setError("Select at least one report");
      return;
    }
    if (!password) {
      setError("Enter your admin password");
      return;
    }
    if (kind === "trash" && confirmText !== "DELETE") {
      setError('Type DELETE to move selected reports to Trash');
      return;
    }
    if (kind === "purge" && confirmText !== "PURGE") {
      setError("Type PURGE to permanently delete selected reports and photos");
      return;
    }
    const label =
      kind === "trash"
        ? `Move ${selected.size} report(s) to Trash?`
        : `Permanently delete ${selected.size} report(s) and their photos? This cannot be undone.`;
    if (!window.confirm(label)) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.set("ids", [...selected].join("|"));
      fd.set("password", password);
      fd.set("confirmText", confirmText);
      try {
        if (kind === "trash") {
          const result = await bulkTrashInspectionsAction(fd);
          setMessage(`Moved ${result.count} report(s) to Trash.`);
        } else {
          const result = await bulkPurgeInspectionsAction(fd);
          setMessage(
            `Purged ${result.purged} report(s) (${result.filesRemoved} files removed).`,
          );
        }
        setSelected(new Set());
        setPassword("");
        setConfirmText("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Bulk action failed");
      }
    });
  }

  async function exportSelected() {
    setError(null);
    setMessage(null);
    if (!selectedRows.length) {
      setError("Select at least one report to export");
      return;
    }
    const live = selectedRows.filter((r) => !r.inTrash);
    if (!live.length) {
      setError("Selected reports are in Trash — restore before exporting");
      return;
    }
    setExportBusy(true);
    try {
      for (const row of live) {
        const fd = new FormData();
        fd.set("inspectionId", row.id);
        const startRes = await fetch("/api/exports/start", {
          method: "POST",
          cache: "no-store",
          body: fd,
        });
        const startText = await startRes.text();
        if (!startRes.ok) {
          if (/^\s*</.test(startText) || startRes.status === 403) {
            throw new Error(
              `Export blocked for ${row.titleLabel} (proxy/WAF). Try again shortly.`,
            );
          }
          let msg = `Export failed for ${row.titleLabel}`;
          try {
            const body = JSON.parse(startText) as { error?: string };
            if (body.error) msg = body.error;
          } catch {
            /* keep */
          }
          throw new Error(msg);
        }
        const started = JSON.parse(startText) as {
          jobId?: string;
          token?: string;
        };
        if (!started.jobId) {
          throw new Error(`Export failed for ${row.titleLabel}`);
        }
        const deadline = Date.now() + 5 * 60 * 1000;
        let downloadUrl: string | null = null;
        let filename = `${row.assetNumber}_${row.id.slice(-6)}_ClientExport.zip`;
        for (;;) {
          if (Date.now() > deadline) {
            throw new Error(`Export timed out for ${row.titleLabel}`);
          }
          await new Promise((r) => setTimeout(r, 900));
          const statusRes = await fetch(
            `/api/exports/start?job=${encodeURIComponent(started.jobId)}`,
            { cache: "no-store" },
          );
          const status = (await statusRes.json().catch(() => null)) as {
            status?: string;
            ready?: boolean;
            filename?: string | null;
            error?: string | null;
            downloadUrl?: string | null;
            token?: string;
          } | null;
          if (!statusRes.ok) {
            throw new Error(
              status?.error || `Export failed for ${row.titleLabel}`,
            );
          }
          if (status?.status === "error") {
            throw new Error(
              status.error || `Export failed for ${row.titleLabel}`,
            );
          }
          if (status?.ready || status?.status === "ready") {
            if (status.filename) filename = status.filename;
            downloadUrl =
              status.downloadUrl ||
              (status.token
                ? `/api/exports/file/${started.jobId}?token=${encodeURIComponent(status.token)}&name=${encodeURIComponent(filename)}`
                : null);
            break;
          }
        }
        if (!downloadUrl) {
          throw new Error(`No download link for ${row.titleLabel}`);
        }
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        await new Promise((r) => setTimeout(r, 400));
      }
      setMessage(`Downloaded ${live.length} client export ZIP(s).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExportBusy(false);
    }
  }

  const busy = pending || exportBusy;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {selected.size} selected · {rows.length} shown
          </p>
          <button
            type="button"
            className="text-xs font-semibold text-[color:var(--ventia-blue)]"
            onClick={toggleAll}
          >
            {selected.size === allIds.length ? "Clear selection" : "Select all shown"}
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Admin password</span>
            <input
              type="password"
              className="field-input w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={busy}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">
              Confirm (<kbd className="font-mono text-xs">DELETE</kbd> or{" "}
              <kbd className="font-mono text-xs">PURGE</kbd>)
            </span>
            <input
              className="field-input w-full"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE or PURGE"
              autoComplete="off"
              disabled={busy}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !selected.size}
            onClick={() => void exportSelected()}
            className="rounded-md bg-[color:var(--ventia-green)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {exportBusy ? "Exporting…" : "Export selected (ZIP)"}
          </button>
          <button
            type="button"
            disabled={busy || !selected.size}
            onClick={() => runBulk("trash")}
            className="rounded-md border border-rose-600/70 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50 dark:text-rose-300"
          >
            Move selected to Trash
          </button>
          <button
            type="button"
            disabled={busy || !selected.size}
            onClick={() => runBulk("purge")}
            className="rounded-md bg-rose-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Purge selected forever
          </button>
        </div>

        {error ? (
          <p className="text-sm text-rose-600" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-sm text-[color:var(--ventia-green)]" role="status">
            {message}
          </p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[color:var(--ventia-muted)]">
          No reports match these filters.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-start gap-3 rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] px-3 py-3"
            >
              <input
                type="checkbox"
                className="mt-1 accent-[color:var(--ventia-green)]"
                checked={selected.has(r.id)}
                onChange={() => toggle(r.id)}
                aria-label={`Select ${r.titleLabel}`}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[color:var(--ventia-ink)]">
                  {r.titleLabel}
                  {r.inTrash ? (
                    <span className="ml-2 text-xs font-semibold text-rose-600">
                      Trash
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-[color:var(--ventia-muted)]">
                  {r.roadName} · {r.assetNumber} · {r.levelLabel} · {r.statusLabel}{" "}
                  · {r.inspectedLabel} · {r.inspectorName}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={r.openHref}
                  className="rounded-md border border-[color:var(--ventia-border)] px-2.5 py-1 text-xs font-semibold"
                >
                  Open
                </Link>
                <Link
                  href={r.manageAssetHref}
                  className="rounded-md border border-[color:var(--ventia-border)] px-2.5 py-1 text-xs font-semibold"
                >
                  Asset
                </Link>
                {!r.inTrash ? (
                  <Link
                    href={`/inspections/${r.id}/client-export`}
                    className="rounded-md border border-[color:var(--ventia-green)] px-2.5 py-1 text-xs font-semibold text-[color:var(--ventia-green)]"
                  >
                    Export
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
