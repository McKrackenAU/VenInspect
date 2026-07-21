"use client";

import { useCallback, useEffect, useState } from "react";

type CheckResult = {
  ok: boolean;
  current?: string;
  currentLabel?: string;
  remote?: string;
  remoteLabel?: string;
  channel?: string;
  repoLabel?: string;
  updateAvailable?: boolean;
  sameVersion?: boolean;
  remoteIsOlder?: boolean;
  error?: string;
};

type StatusPayload = {
  status: {
    state: string;
    message: string;
    fromVersion?: string;
    toVersion?: string;
    channel?: string;
    logTail?: string;
  };
  inProgress?: boolean;
};

export function SystemUpdatePanel({
  currentLabel,
  defaultChannel,
}: {
  currentLabel: string;
  defaultChannel: "gitea" | "github";
}) {
  const [channel, setChannel] = useState<"gitea" | "github">(defaultChannel);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState<StatusPayload["status"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const res = await fetch("/api/admin/update", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as StatusPayload;
    setStatus(data.status);
    const busy =
      data.inProgress === true ||
      data.status.state === "running" ||
      data.status.state === "requested";
    setUpdating(busy);
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    // Keep polling while busy, and also once after load if status looks stuck
    // so normalizeStale can clear abandoned "running" JSON.
    const shouldPoll =
      updating ||
      status?.state === "running" ||
      status?.state === "requested" ||
      status?.state === "error";
    if (!shouldPoll) return;
    const id = setInterval(() => {
      void refreshStatus();
    }, 3000);
    return () => clearInterval(id);
  }, [updating, status?.state, refreshStatus]);

  async function onCheck() {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/update-check?channel=${channel}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as CheckResult;
      setCheck(data);
      if (!data.ok) setError(data.error ?? "Check failed");
    } catch {
      setError("Could not check for updates");
    } finally {
      setChecking(false);
    }
  }

  async function onUpdate() {
    if (
      !window.confirm(
        "Build the latest release in the background, then restart VenInspect briefly (a few seconds). Continue?",
      )
    ) {
      return;
    }
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Update request failed");
        setUpdating(false);
        return;
      }
      setStatus(data.status);
    } catch {
      setError("Update request failed");
      setUpdating(false);
    }
  }

  async function onReset() {
    if (
      !window.confirm(
        "Clear stuck update state? Only do this if the updater is not actually building right now.",
      )
    ) {
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Reset failed");
        return;
      }
      setStatus(data.status);
      setUpdating(false);
    } catch {
      setError("Reset failed");
    }
  }

  const showReset =
    status?.state === "running" ||
    status?.state === "requested" ||
    status?.state === "error" ||
    updating;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-[color:var(--ventia-muted)]">Update source</span>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as "gitea" | "github")}
            className="field-input"
          >
            <option value="gitea">Gitea (LAN / McKraken)</option>
            <option value="github">GitHub (McKrackenAU)</option>
          </select>
        </label>
        <div className="rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--ventia-green-tint)] px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-[color:var(--ventia-muted)]">
            Installed
          </p>
          <p className="text-xl font-bold text-[color:var(--ventia-green)]">{currentLabel}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onCheck()}
          disabled={checking || updating}
          className="rounded-xl border border-[color:var(--ventia-border)] px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {checking ? "Checking…" : "Check for updates"}
        </button>
        <button
          type="button"
          onClick={() => void onUpdate()}
          disabled={updating || (check != null && check.ok && !check.updateAvailable)}
          className="rounded-xl bg-[color:var(--ventia-green)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {updating ? "Updating…" : "Update to latest"}
        </button>
        {showReset ? (
          <button
            type="button"
            onClick={() => void onReset()}
            className="rounded-xl border border-amber-500/50 px-4 py-2.5 text-sm font-semibold text-amber-800 dark:text-amber-200"
          >
            Reset stuck update
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      {check?.ok ? (
        <div className="rounded-xl border border-[color:var(--ventia-border)] px-4 py-3 text-sm">
          <p>
            <span className="text-[color:var(--ventia-muted)]">Remote ({check.repoLabel}): </span>
            <strong>{check.remoteLabel}</strong>
          </p>
          {check.updateAvailable ? (
            <p className="mt-1 font-medium text-[color:var(--ventia-green-mid)]">
              Update available — {check.currentLabel} → {check.remoteLabel}
            </p>
          ) : check.sameVersion ? (
            <p className="mt-1 text-[color:var(--ventia-muted)]">Already on the latest version.</p>
          ) : (
            <p className="mt-1 text-[color:var(--ventia-muted)]">
              Remote is older than this install (local ahead of remote).
            </p>
          )}
        </div>
      ) : null}

      {status && status.state !== "idle" ? (
        <div className="rounded-xl border border-[color:var(--ventia-border)] px-4 py-3 text-sm">
          <p className="font-semibold capitalize">{status.state}</p>
          <p className="mt-1 text-[color:var(--ventia-muted)]">{status.message}</p>
          {status.toVersion ? (
            <p className="mt-1 text-xs">
              {status.fromVersion} → {status.toVersion}
            </p>
          ) : null}
          {status.logTail ? (
            <pre className="mt-3 max-h-40 overflow-auto rounded-lg bg-black/90 p-3 text-[0.7rem] text-emerald-200">
              {status.logTail}
            </pre>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs text-[color:var(--ventia-muted)]">
        App admins only queue an update (write a request file). systemd runs the build as root —
        no Linux “super admin” login is required in the web UI. Only one updater runs at a time.
        If status stays on “running” with no progress, use Reset stuck update.
      </p>
    </div>
  );
}
