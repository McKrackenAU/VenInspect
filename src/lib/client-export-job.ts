/**
 * Client-export jobs: build ZIP on disk, download via short-lived job id.
 * Avoids Cloudflare/WAF 403s on long POSTs that return large application/zip bodies.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDataDir } from "@/lib/paths";

const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour
const JOB_ID_RE = /^[a-f0-9]{32}$/;

export type ClientExportJobStatus = "pending" | "ready" | "error";

export type ClientExportJob = {
  id: string;
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
  const job: ClientExportJob = {
    id,
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
    return job;
  } catch {
    return null;
  }
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
