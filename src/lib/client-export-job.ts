/**
 * Client-export jobs: build ZIP on disk, download via short-lived job + token.
 * Token download bypasses session/middleware so Cloudflare can serve the file
 * as a normal browser navigation (fetch() of large ZIPs often gets WAF 403).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDataDir } from "@/lib/paths";

const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour
const JOB_ID_RE = /^[a-f0-9]{32}$/;
const TOKEN_RE = /^[a-f0-9]{32}$/;

export type ClientExportJobStatus = "pending" | "ready" | "error";

export type ClientExportJob = {
  id: string;
  /** Opaque download secret — required for /api/exports/file */
  token: string;
  inspectionId: string;
  userId: string;
  status: ClientExportJobStatus;
  filename: string | null;
  error: string | null;
  createdAt: number;
  exp: number;
};

function jobsDir() {
  return path.join(getDataDir(), "client-exports");
}

function jobMetaPath(id: string) {
  return path.join(jobsDir(), `${id}.json`);
}

export function jobZipPath(id: string) {
  return path.join(jobsDir(), `${id}.zip`);
}

function pruneExpiredJobs() {
  const dir = jobsDir();
  if (!fs.existsSync(dir)) return;
  const now = Date.now();
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const id = name.slice(0, -".json".length);
    try {
      const raw = JSON.parse(
        fs.readFileSync(path.join(dir, name), "utf8"),
      ) as ClientExportJob;
      if (!raw.exp || raw.exp < now) {
        try {
          fs.unlinkSync(path.join(dir, name));
        } catch {
          /* ignore */
        }
        try {
          fs.unlinkSync(jobZipPath(id));
        } catch {
          /* ignore */
        }
      }
    } catch {
      try {
        fs.unlinkSync(path.join(dir, name));
      } catch {
        /* ignore */
      }
    }
  }
}

export function isClientExportJobId(id: string | null | undefined): boolean {
  return JOB_ID_RE.test((id ?? "").trim().toLowerCase());
}

export function createClientExportJob(input: {
  inspectionId: string;
  userId: string;
}): ClientExportJob {
  pruneExpiredJobs();
  fs.mkdirSync(jobsDir(), { recursive: true });
  const id = crypto.randomBytes(16).toString("hex");
  const token = crypto.randomBytes(16).toString("hex");
  const job: ClientExportJob = {
    id,
    token,
    inspectionId: input.inspectionId,
    userId: input.userId,
    status: "pending",
    filename: null,
    error: null,
    createdAt: Date.now(),
    exp: Date.now() + JOB_TTL_MS,
  };
  fs.writeFileSync(jobMetaPath(id), JSON.stringify(job), "utf8");
  return job;
}

export function readClientExportJob(
  id: string | null | undefined,
): ClientExportJob | null {
  const jobId = (id ?? "").trim().toLowerCase();
  if (!JOB_ID_RE.test(jobId)) return null;
  try {
    const job = JSON.parse(
      fs.readFileSync(jobMetaPath(jobId), "utf8"),
    ) as ClientExportJob;
    if (!job.exp || job.exp < Date.now()) {
      try {
        fs.unlinkSync(jobMetaPath(jobId));
      } catch {
        /* ignore */
      }
      try {
        fs.unlinkSync(jobZipPath(jobId));
      } catch {
        /* ignore */
      }
      return null;
    }
    // Older jobs (pre-token) — treat as invalid for token downloads
    if (!job.token || !TOKEN_RE.test(job.token)) {
      return { ...job, token: job.token || "" };
    }
    return job;
  } catch {
    return null;
  }
}

export function verifyClientExportDownload(
  jobId: string | null | undefined,
  token: string | null | undefined,
): ClientExportJob | null {
  const job = readClientExportJob(jobId);
  if (!job || job.status !== "ready") return null;
  const t = (token ?? "").trim().toLowerCase();
  if (!TOKEN_RE.test(t) || !job.token || t !== job.token) return null;
  return job;
}

export function updateClientExportJob(
  id: string,
  patch: Partial<
    Pick<ClientExportJob, "status" | "filename" | "error" | "exp">
  >,
): ClientExportJob | null {
  const current = readClientExportJob(id);
  if (!current) return null;
  const next: ClientExportJob = { ...current, ...patch };
  fs.writeFileSync(jobMetaPath(id), JSON.stringify(next), "utf8");
  return next;
}

export function writeClientExportZip(id: string, zip: Buffer) {
  fs.mkdirSync(jobsDir(), { recursive: true });
  fs.writeFileSync(jobZipPath(id), zip);
}

export function clientExportFileUrl(job: {
  id: string;
  token: string;
  filename?: string | null;
}) {
  const q = new URLSearchParams({ token: job.token });
  if (job.filename) q.set("name", job.filename);
  return `/api/exports/file/${job.id}?${q.toString()}`;
}
