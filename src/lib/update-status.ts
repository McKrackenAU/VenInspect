import fs from "node:fs";
import path from "node:path";
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
  logTail?: string;
};

/** Brief window after writing update.request before systemd claims it. */
const CLAIM_GRACE_MS = 30_000;

function statusPath() {
  return path.join(getDataDir(), "update-status.json");
}

function requestPath() {
  return path.join(getDataDir(), "update.request");
}

function activePath() {
  return path.join(getDataDir(), "update.request.active");
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

/**
 * If the UI says running/requested but nothing is queued on disk, the updater
 * is not actually working (manual cleanup, crashed jobs, path unit never fired).
 */
function normalizeStale(status: UpdateStatus): UpdateStatus {
  if (status.state !== "running" && status.state !== "requested") return status;

  if (hasClaimFiles()) return status;

  const started = status.startedAt || status.requestedAt;
  const ageMs = started ? Date.now() - new Date(started).getTime() : Number.POSITIVE_INFINITY;

  // Allow a short grace so a brand-new request is not cleared before systemd starts.
  if (ageMs < CLAIM_GRACE_MS) return status;

  const fixed: UpdateStatus = {
    ...status,
    state: "error",
    message:
      "Update is not running (no active request on disk). Use Reset stuck update, then try again.",
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
  // Disk claim is the source of truth — stale JSON alone must not block forever.
  if (hasClaimFiles()) return true;
  const s = readUpdateStatus();
  return s.state === "running" || s.state === "requested";
}

export function requestUpdate(opts: {
  channel: string;
  fromVersion: string;
}) {
  if (isUpdateInProgress()) {
    throw new Error("An update is already in progress");
  }
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });
  const payload = {
    requestedAt: new Date().toISOString(),
    channel: opts.channel,
    fromVersion: opts.fromVersion,
  };
  try {
    fs.unlinkSync(activePath());
  } catch {
    /* ignore */
  }
  fs.writeFileSync(requestPath(), JSON.stringify(payload, null, 2), "utf8");
  writeUpdateStatus({
    state: "requested",
    message: "Update queued — waiting for updater service…",
    requestedAt: payload.requestedAt,
    fromVersion: opts.fromVersion,
    channel: opts.channel,
  });
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
  const next: UpdateStatus = {
    state: "idle",
    message: "Update state cleared. Safe to request a new update.",
    finishedAt: new Date().toISOString(),
  };
  writeUpdateStatus(next);
  return next;
}
