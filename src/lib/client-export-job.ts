/**
 * Client-export jobs: build ZIP on disk, download via short-lived job + token.
 * Large files are served as ≤10 MiB chunks (Cloudflare-safe).
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDataDir } from "@/lib/paths";
import {
  EXPORT_CHUNK_SIZE,
  planExportChunks,
  type ExportChunkInfo,
  type ExportDownloadManifest,
} from "@/lib/export-chunks";

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
  /** Set when ZIP is ready */
  size?: number | null;
  sha256?: string | null;
  chunkSize?: number | null;
  chunkCount?: number | null;
  chunkDigests?: string[] | null;
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
    Pick<
      ClientExportJob,
      | "status"
      | "filename"
      | "error"
      | "exp"
      | "size"
      | "sha256"
      | "chunkSize"
      | "chunkCount"
      | "chunkDigests"
    >
  >,
): ClientExportJob | null {
  const current = readClientExportJob(id);
  if (!current) return null;
  const next: ClientExportJob = { ...current, ...patch };
  fs.writeFileSync(jobMetaPath(id), JSON.stringify(next), "utf8");
  return next;
}

export type WrittenExportZip = {
  size: number;
  sha256: string;
  chunkSize: number;
  chunkCount: number;
  chunkDigests: string[];
};

/** Write ZIP atomically and return chunk digests for the download manifest. */
export function writeClientExportZip(
  id: string,
  zip: Buffer,
  chunkSize: number = EXPORT_CHUNK_SIZE,
): WrittenExportZip {
  fs.mkdirSync(jobsDir(), { recursive: true });
  const finalPath = jobZipPath(id);
  const tmpPath = `${finalPath}.tmp`;
  fs.writeFileSync(tmpPath, zip);

  const plan = planExportChunks(zip.length, chunkSize);
  const chunkDigests = plan.map(({ offset, length }) =>
    crypto
      .createHash("sha256")
      .update(zip.subarray(offset, offset + length))
      .digest("hex"),
  );
  const sha256 = crypto.createHash("sha256").update(zip).digest("hex");

  fs.renameSync(tmpPath, finalPath);

  return {
    size: zip.length,
    sha256,
    chunkSize,
    chunkCount: plan.length,
    chunkDigests,
  };
}

export function buildExportManifest(job: ClientExportJob): ExportDownloadManifest | null {
  if (job.status !== "ready") return null;
  const zipPath = jobZipPath(job.id);
  if (!fs.existsSync(zipPath)) return null;

  const size =
    typeof job.size === "number" && job.size >= 0
      ? job.size
      : fs.statSync(zipPath).size;
  const chunkSize = job.chunkSize || EXPORT_CHUNK_SIZE;
  const plan = planExportChunks(size, chunkSize);

  // Recompute digests if missing (older jobs) — still correct, just slower once.
  let digests = job.chunkDigests;
  let sha256 = job.sha256;
  if (!digests?.length || digests.length !== plan.length || !sha256) {
    const fd = fs.openSync(zipPath, "r");
    try {
      digests = [];
      const whole = crypto.createHash("sha256");
      for (const { offset, length } of plan) {
        const buf = Buffer.alloc(length);
        fs.readSync(fd, buf, 0, length, offset);
        digests.push(crypto.createHash("sha256").update(buf).digest("hex"));
        whole.update(buf);
      }
      sha256 = whole.digest("hex");
    } finally {
      fs.closeSync(fd);
    }
    updateClientExportJob(job.id, {
      size,
      sha256,
      chunkSize,
      chunkCount: plan.length,
      chunkDigests: digests,
    });
  }

  const chunks: ExportChunkInfo[] = plan.map((p, index) => ({
    index,
    offset: p.offset,
    length: p.length,
    sha256: digests![index]!,
  }));

  return {
    ok: true,
    protocol: "veninspect-chunks-v1",
    jobId: job.id,
    filename: job.filename || "client-export.zip",
    size,
    chunkSize,
    chunkCount: chunks.length,
    sha256: sha256!,
    chunks,
  };
}

/** Read one chunk from the on-disk ZIP (does not load the whole file). */
export function readExportChunk(
  job: ClientExportJob,
  index: number,
): { data: Buffer; sha256: string; offset: number; length: number } | null {
  const manifest = buildExportManifest(job);
  if (!manifest) return null;
  const meta = manifest.chunks[index];
  if (!meta) return null;
  const zipPath = jobZipPath(job.id);
  const fd = fs.openSync(zipPath, "r");
  try {
    const data = Buffer.alloc(meta.length);
    const n = fs.readSync(fd, data, 0, meta.length, meta.offset);
    if (n !== meta.length) return null;
    const sha256 = crypto.createHash("sha256").update(data).digest("hex");
    if (sha256 !== meta.sha256) return null;
    return { data, sha256, offset: meta.offset, length: meta.length };
  } finally {
    fs.closeSync(fd);
  }
}

export function clientExportManifestUrl(job: {
  id: string;
  token: string;
}) {
  return `/api/exports/file/${job.id}/manifest?token=${encodeURIComponent(job.token)}`;
}

export function clientExportFileUrl(job: {
  id: string;
  token: string;
  filename?: string | null;
}) {
  // Prefer manifest-based chunked download; keep this helper for status JSON compat.
  return clientExportManifestUrl(job);
}
