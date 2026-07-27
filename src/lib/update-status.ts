import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { getDataDir } from "@/lib/paths";

export type UpdateStatus = {
  state: "idle" | "requested" | "running" | "success" | "error";
  message: string;
  requestedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  fromVersion?: string;
  toVersion?: string;
  channel?: string;
  /** Git ref being installed (tag or main). */
  ref?: string;
  logTail?: string;
};

/** Brief window after writing update.request before systemd claims it. */
const CLAIM_GRACE_MS = 45_000;

function statusPath() {
  return path.join(getDataDir(), "update-status.json");
}

function requestPath() {
  return path.join(getDataDir(), "update.request");
}

function activePath() {
  return path.join(getDataDir(), "update.request.active");
}

function logPath() {
  return path.join(getDataDir(), "update.log");
}

function hasClaimFiles(): boolean {
  return fs.existsSync(activePath()) || fs.existsSync(requestPath());
}

export function readUpdateStatus(): UpdateStatus {
  try {
    const raw = fs.readFileSync(statusPath(), "utf8");
    const status = JSON.parse(raw) as UpdateStatus;
    return normalizeStale(status);
  } catch {
    return { state: "idle", message: "No update activity" };
  }
}

function normalizeStale(status: UpdateStatus): UpdateStatus {
  if (status.state !== "running" && status.state !== "requested") return status;

  if (hasClaimFiles()) return status;

  const started = status.startedAt || status.requestedAt;
  const ageMs = started ? Date.now() - new Date(started).getTime() : Number.POSITIVE_INFINITY;

  if (ageMs < CLAIM_GRACE_MS) return status;

  const fixed: UpdateStatus = {
    ...status,
    state: "error",
    message:
      "Update did not start (no active job). Click Reset stuck update, then Update to latest again.",
    finishedAt: new Date().toISOString(),
  };
  try {
    writeUpdateStatus(fixed);
  } catch {
    /* ignore */
  }
  return fixed;
}

export function writeUpdateStatus(status: UpdateStatus) {
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(statusPath(), JSON.stringify(status, null, 2), "utf8");
}

export function isUpdateInProgress(): boolean {
  if (hasClaimFiles()) return true;
  const s = readUpdateStatus();
  return s.state === "running" || s.state === "requested";
}

function kickUpdaterService() {
  // Best-effort: PathExists should start the unit; sudoers allows an explicit start.
  execFile(
    "sudo",
    ["-n", "systemctl", "reset-failed", "veninspect-update.service"],
    { timeout: 5000 },
    () => {
      execFile(
        "sudo",
        ["-n", "systemctl", "start", "veninspect-update.service"],
        { timeout: 5000 },
        () => {
          /* ignore — path unit is the primary trigger */
        },
      );
    },
  );
}

export function requestUpdate(opts: {
  channel: string;
  fromVersion: string;
  /** Git tag or branch to clone (e.g. v0.1.58). Defaults to main (latest). */
  ref?: string | null;
  toVersion?: string | null;
}) {
  if (isUpdateInProgress()) {
    throw new Error("An update is already in progress — use Reset if it is stuck");
  }
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });

  const channel =
    opts.channel === "github" || opts.channel === "gitea" ? opts.channel : "github";

  const ref = (opts.ref ?? "").trim() || "main";
  const toVersion = (opts.toVersion ?? "").trim() || undefined;

  // Must delete first so PathExists sees a new file creation (overwrite alone may not fire).
  for (const p of [requestPath(), activePath()]) {
    try {
      fs.unlinkSync(p);
    } catch {
      /* ignore */
    }
  }

  const payload = {
    requestedAt: new Date().toISOString(),
    channel,
    fromVersion: opts.fromVersion,
    ref,
    ...(toVersion ? { toVersion } : {}),
  };
  fs.writeFileSync(requestPath(), JSON.stringify(payload, null, 2), "utf8");

  const targetLabel =
    ref === "main"
      ? "latest (main)"
      : toVersion
        ? `v${toVersion.replace(/^v/i, "")}`
        : ref;

  writeUpdateStatus({
    state: "requested",
    message: `Update queued → ${targetLabel} via ${channel} — starting updater…`,
    requestedAt: payload.requestedAt,
    fromVersion: opts.fromVersion,
    toVersion,
    channel,
    ref,
    logTail: "",
  });
  kickUpdaterService();
}

/** Clear stuck UI / claim files so a new update can be requested. */
export function resetUpdateState(): UpdateStatus {
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });
  for (const p of [requestPath(), activePath()]) {
    try {
      fs.unlinkSync(p);
    } catch {
      /* ignore */
    }
  }
  try {
    fs.writeFileSync(logPath(), "", "utf8");
  } catch {
    /* ignore */
  }
  const next: UpdateStatus = {
    state: "idle",
    message: "Update state cleared. Safe to request a new update.",
    finishedAt: new Date().toISOString(),
    logTail: "",
  };
  writeUpdateStatus(next);
  return next;
}
