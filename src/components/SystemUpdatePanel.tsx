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
  probed?: { channel: string; remote: string; remoteLabel: string }[];
};

type ReleaseItem = {
  tag: string;
  version: string;
  name: string;
  label: string;
  publishedAt: string | null;
  prerelease: boolean;
  isCurrent: boolean;
  isNewer: boolean;
  isOlder: boolean;
};

type ReleasesPayload = {
  ok: boolean;
  releases?: ReleaseItem[];
  repoLabel?: string;
  error?: string;
};

type StatusPayload = {
  status: {
    state: string;
    message: string;
    fromVersion?: string;
    toVersion?: string;
    channel?: string;
    ref?: string;
    logTail?: string;
  };
  inProgress?: boolean;
};

const LATEST_VALUE = "__latest__";

export function SystemUpdatePanel({
  currentLabel,
  defaultChannel,
}: {
  currentLabel: string;
  defaultChannel: "gitea" | "github";
}) {
  const [channel, setChannel] = useState<"gitea" | "github">(defaultChannel);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [selected, setSelected] = useState<string>(LATEST_VALUE);
  const [checking, setChecking] = useState(false);
  const [loadingReleases, setLoadingReleases] = useState(false);
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

  const loadReleases = useCallback(async (ch: "gitea" | "github") => {
    setLoadingReleases(true);
    try {
      const res = await fetch(`/api/admin/releases?channel=${ch}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as ReleasesPayload;
      if (data.ok && data.releases?.length) {
        setReleases(data.releases);
        // Keep selection if still present; otherwise latest
        setSelected((prev) => {
          if (prev === LATEST_VALUE) return LATEST_VALUE;
          return data.releases!.some((r) => r.tag === prev)
            ? prev
            : LATEST_VALUE;
        });
      } else {
        setReleases([]);
        if (data.error) {
          /* non-fatal — check still works */
        }
      }
    } catch {
      setReleases([]);
    } finally {
      setLoadingReleases(false);
    }
  }, []);

  const runCheck = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/update-check?channel=auto", {
        cache: "no-store",
      });
      const data = (await res.json()) as CheckResult;
      setCheck(data);
      if (data.ok && (data.channel === "github" || data.channel === "gitea")) {
        setChannel(data.channel);
        void loadReleases(data.channel);
      }
      if (!data.ok) setError(data.error ?? "Check failed");
    } catch {
      setError("Could not check for updates");
    } finally {
      setChecking(false);
    }
  }, [loadReleases]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  useEffect(() => {
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

  const selectedRelease =
    selected === LATEST_VALUE
      ? null
      : releases.find((r) => r.tag === selected) ?? null;

  async function queueInstall(opts: {
    ref: string;
    toVersion?: string;
    confirmMessage: string;
  }) {
    if (!window.confirm(opts.confirmMessage)) return;
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          ref: opts.ref,
          toVersion: opts.toVersion,
        }),
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

  async function onUpdateLatest() {
    const remote = check?.remoteLabel ?? "latest";
    await queueInstall({
      ref: "main",
      confirmMessage: `Install latest from ${channel === "github" ? "GitHub" : "Gitea"} (${remote})?\n\nThe app stays up during the build, then restarts briefly to swap.`,
    });
  }

  async function onInstallSelected() {
    if (selected === LATEST_VALUE) {
      await onUpdateLatest();
      return;
    }
    const rel = selectedRelease;
    if (!rel) {
      setError("Choose a release from the list");
      return;
    }
    const action = rel.isOlder
      ? "Roll back"
      : rel.isNewer
        ? "Upgrade"
        : "Reinstall";
    await queueInstall({
      ref: rel.tag,
      toVersion: rel.version,
      confirmMessage: `${action} to ${rel.label}?\n\nThis clones that release tag, builds it, and swaps the live app. Use this to undo a bad beta push.`,
    });
  }

  async function onReset() {
    if (
      !window.confirm(
        "Clear stuck update state? Only if the updater is not actually building right now.",
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

  const installLabel = (() => {
    if (updating) return "Updating…";
    if (selected === LATEST_VALUE) return "Install latest";
    if (selectedRelease?.isOlder) return `Roll back to ${selectedRelease.label}`;
    if (selectedRelease?.isNewer) return `Install ${selectedRelease.label}`;
    if (selectedRelease) return `Reinstall ${selectedRelease.label}`;
    return "Install selected";
  })();

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-[color:var(--ventia-muted)]">
            Update source
          </span>
          <select
            value={channel}
            onChange={(e) => {
              const next = e.target.value as "gitea" | "github";
              setChannel(next);
              setCheck(null);
              setSelected(LATEST_VALUE);
              void loadReleases(next);
            }}
            disabled={updating}
            className="field-input"
          >
            <option value="github">GitHub (live)</option>
            <option value="gitea">Gitea (LAN)</option>
          </select>
          <span className="block text-xs text-[color:var(--ventia-muted)]">
            Live installs use GitHub. Check probes both and selects the newest.
          </span>
        </label>
        <div className="rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--ventia-green-tint)] px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-[color:var(--ventia-muted)]">
            Installed
          </p>
          <p className="text-xl font-bold text-[color:var(--ventia-green)]">
            {currentLabel}
          </p>
        </div>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-[color:var(--ventia-muted)]">
          Version to install
        </span>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={updating || loadingReleases}
          className="field-input"
        >
          <option value={LATEST_VALUE}>
            Latest on main
            {check?.remoteLabel ? ` (${check.remoteLabel})` : ""}
          </option>
          {releases.map((r) => (
            <option key={r.tag} value={r.tag}>
              {r.label}
              {r.isCurrent ? " — current" : ""}
              {r.isOlder ? " — older" : ""}
              {r.isNewer ? " — newer" : ""}
              {r.prerelease ? " (pre)" : ""}
            </option>
          ))}
        </select>
        <span className="block text-xs text-[color:var(--ventia-muted)]">
          {loadingReleases
            ? "Loading releases…"
            : releases.length > 0
              ? `${releases.length} releases from ${channel === "github" ? "GitHub" : "Gitea"}. Pick an older build to undo a bad push.`
              : "Could not load release list yet — you can still install latest."}
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            void runCheck();
            void loadReleases(channel);
          }}
          disabled={checking || updating}
          className="btn-secondary px-4 py-2.5 text-sm"
          style={{ minHeight: "2.5rem" }}
        >
          {checking || loadingReleases ? "Checking…" : "Check for updates"}
        </button>
        <button
          type="button"
          onClick={() => void onInstallSelected()}
          disabled={updating}
          className="btn-primary-inline"
        >
          {installLabel}
        </button>
        {showReset ? (
          <button
            type="button"
            onClick={() => void onReset()}
            className="rounded-xl border border-amber-600 bg-[color:var(--panel)] px-4 py-2.5 text-sm font-semibold text-amber-900 dark:border-amber-500/50 dark:text-amber-200"
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
            <span className="text-[color:var(--ventia-muted)]">
              Newest remote ({check.repoLabel}):{" "}
            </span>
            <strong>{check.remoteLabel}</strong>
          </p>
          {check.updateAvailable ? (
            <p className="mt-1 font-medium text-[color:var(--ventia-green-mid)]">
              Update available — {check.currentLabel} → {check.remoteLabel}
            </p>
          ) : check.sameVersion ? (
            <p className="mt-1 text-[color:var(--ventia-muted)]">
              Already on the latest version. You can still reinstall or roll back
              below.
            </p>
          ) : (
            <p className="mt-1 text-[color:var(--ventia-muted)]">
              Remote tip is older than this install (local ahead). Use the version
              list to pick a known-good release.
            </p>
          )}
        </div>
      ) : null}

      {status && status.state !== "idle" ? (
        <div className="rounded-xl border border-[color:var(--ventia-border)] px-4 py-3 text-sm">
          <p className="font-semibold capitalize">
            {status.state}
            {status.channel ? (
              <span className="ml-2 text-xs font-normal text-[color:var(--ventia-muted)]">
                via {status.channel}
                {status.ref ? ` @ ${status.ref}` : ""}
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-[color:var(--ventia-muted)]">{status.message}</p>
          {status.toVersion ? (
            <p className="mt-1 text-xs">
              {status.fromVersion} → {status.toVersion}
            </p>
          ) : null}
          {status.logTail ? (
            <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-black/90 p-3 text-[0.7rem] text-emerald-200">
              {status.logTail}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
