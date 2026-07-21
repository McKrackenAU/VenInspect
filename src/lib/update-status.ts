import fs from "node:fs";
import path from "node:path";
import { getDataDir } from "@/lib/paths";

export type UpdateStatus = {
  state:
    | "idle"
    | "requested"
    | "running"
    | "success"
    | "error";
  message: string;
  requestedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  fromVersion?: string;
  toVersion?: string;
  channel?: string;
  logTail?: string;
};

function statusPath() {
  return path.join(getDataDir(), "update-status.json");
}

function requestPath() {
  return path.join(getDataDir(), "update.request");
}

export function readUpdateStatus(): UpdateStatus {
  try {
    const raw = fs.readFileSync(statusPath(), "utf8");
    return JSON.parse(raw) as UpdateStatus;
  } catch {
    return { state: "idle", message: "No update activity" };
  }
}

export function writeUpdateStatus(status: UpdateStatus) {
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(statusPath(), JSON.stringify(status, null, 2), "utf8");
}

export function requestUpdate(opts: {
  channel: string;
  fromVersion: string;
}) {
  const dir = getDataDir();
  fs.mkdirSync(dir, { recursive: true });
  const payload = {
    requestedAt: new Date().toISOString(),
    channel: opts.channel,
    fromVersion: opts.fromVersion,
  };
  fs.writeFileSync(requestPath(), JSON.stringify(payload, null, 2), "utf8");
  writeUpdateStatus({
    state: "requested",
    message: "Update queued — waiting for updater service…",
    requestedAt: payload.requestedAt,
    fromVersion: opts.fromVersion,
    channel: opts.channel,
  });
}
