/**
 * Browser-side chunked download: fetch ≤10 MiB parts, verify digests, assemble Blob.
 */

import {
  EXPORT_CHUNK_MAX_RETRIES,
  type ExportDownloadManifest,
} from "@/lib/export-chunks";

export type ChunkDownloadProgress = {
  phase: "manifest" | "chunks" | "verify" | "done";
  chunksDone: number;
  chunkCount: number;
  bytesDone: number;
  bytesTotal: number;
};

function isHtmlResponse(text: string, contentType: string) {
  return (
    contentType.includes("text/html") ||
    /^\s*</.test(text) ||
    /cloudflare|cf-ray|just a moment/i.test(text)
  );
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hash = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(hash)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Very old browsers — skip verify (server already checked on write)
  return "";
}

async function fetchJson(url: string): Promise<{
  ok: boolean;
  status: number;
  body: unknown;
  text: string;
}> {
  const res = await fetch(url, { cache: "no-store", credentials: "omit" });
  const text = await res.text();
  const ct = res.headers.get("content-type") || "";
  if (isHtmlResponse(text, ct)) {
    throw new Error(
      "Cloudflare blocked the download manifest. Wait a minute and try again.",
    );
  }
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body, text };
}

async function fetchChunkWithRetry(
  url: string,
  expectedSha: string,
  expectedLength: number,
): Promise<ArrayBuffer> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < EXPORT_CHUNK_MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { cache: "no-store", credentials: "omit" });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (isHtmlResponse(text, ct)) {
          throw new Error("Cloudflare blocked a download chunk");
        }
        let msg = `Chunk download failed (${res.status})`;
        try {
          const body = JSON.parse(text) as { error?: string };
          if (body.error) msg = body.error;
        } catch {
          /* keep */
        }
        throw new Error(msg);
      }
      if (ct.includes("text/html")) {
        throw new Error("Cloudflare blocked a download chunk");
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength !== expectedLength) {
        throw new Error(
          `Chunk size mismatch (got ${buf.byteLength}, expected ${expectedLength})`,
        );
      }
      const digest = await sha256Hex(buf);
      if (digest && digest !== expectedSha) {
        throw new Error("Chunk checksum mismatch — retrying");
      }
      return buf;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error("Chunk download failed");
      // Backoff: 400ms, 800ms, 1600ms, 3200ms
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
    }
  }
  throw lastError ?? new Error("Chunk download failed");
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename.endsWith(".zip") ? filename : filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

/**
 * Download a finished export via manifest + ≤10 MiB chunks, verify, save.
 */
export async function downloadExportViaChunks(
  manifestUrl: string,
  fallbackName: string,
  onProgress?: (p: ChunkDownloadProgress) => void,
): Promise<{ filename: string; size: number }> {
  onProgress?.({
    phase: "manifest",
    chunksDone: 0,
    chunkCount: 0,
    bytesDone: 0,
    bytesTotal: 0,
  });

  const manifestRes = await fetchJson(manifestUrl);
  if (!manifestRes.ok) {
    const err =
      manifestRes.body &&
      typeof manifestRes.body === "object" &&
      manifestRes.body &&
      "error" in manifestRes.body
        ? String((manifestRes.body as { error: string }).error)
        : `Manifest failed (${manifestRes.status})`;
    throw new Error(err);
  }
  const manifest = manifestRes.body as ExportDownloadManifest;
  if (
    !manifest ||
    manifest.protocol !== "veninspect-chunks-v1" ||
    !manifest.jobId ||
    !Array.isArray(manifest.chunks) ||
    typeof manifest.size !== "number"
  ) {
    throw new Error("Invalid download manifest from server");
  }

  const filename = manifest.filename || fallbackName;
  const chunkCount = manifest.chunkCount;
  onProgress?.({
    phase: "chunks",
    chunksDone: 0,
    chunkCount,
    bytesDone: 0,
    bytesTotal: manifest.size,
  });

  // Sequential chunks — simpler and kinder to Cloudflare / mobile radios.
  const parts: ArrayBuffer[] = [];
  let bytesDone = 0;
  for (const chunk of manifest.chunks) {
    const url = new URL(manifestUrl, window.location.origin);
    // Replace path ending /manifest with /chunk/N — or use query form
    // Manifest URL shape: /api/exports/file/{id}/manifest?token=
    const base = url.pathname.replace(/\/manifest\/?$/, "");
    const chunkUrl = `${base}/chunk/${chunk.index}?${url.searchParams.toString()}`;
    const buf = await fetchChunkWithRetry(
      chunkUrl,
      chunk.sha256,
      chunk.length,
    );
    parts.push(buf);
    bytesDone += buf.byteLength;
    onProgress?.({
      phase: "chunks",
      chunksDone: parts.length,
      chunkCount,
      bytesDone,
      bytesTotal: manifest.size,
    });
  }

  onProgress?.({
    phase: "verify",
    chunksDone: chunkCount,
    chunkCount,
    bytesDone,
    bytesTotal: manifest.size,
  });

  const blob = new Blob(parts, { type: "application/octet-stream" });
  if (blob.size !== manifest.size) {
    throw new Error(
      `Assembled size mismatch (got ${blob.size}, expected ${manifest.size})`,
    );
  }
  const whole = await blob.arrayBuffer();
  const wholeDigest = await sha256Hex(whole);
  if (wholeDigest && wholeDigest !== manifest.sha256) {
    throw new Error(
      "File checksum mismatch after download — try building the pack again",
    );
  }

  triggerBlobDownload(blob, filename);
  onProgress?.({
    phase: "done",
    chunksDone: chunkCount,
    chunkCount,
    bytesDone: manifest.size,
    bytesTotal: manifest.size,
  });
  return { filename, size: manifest.size };
}

export function formatDownloadProgress(p: ChunkDownloadProgress): string {
  if (p.phase === "manifest") return "Preparing download…";
  if (p.phase === "verify") return "Verifying download…";
  if (p.phase === "done") return "Download complete";
  if (p.chunkCount <= 1) {
    const mb = (p.bytesTotal / (1024 * 1024)).toFixed(1);
    return `Downloading (${mb} MB)…`;
  }
  return `Downloading chunk ${p.chunksDone}/${p.chunkCount}…`;
}
