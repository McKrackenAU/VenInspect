/**
 * Chunked export downloads — stay under Cloudflare’s ~100 MB response limit.
 * Each chunk is capped at 10 MiB; client reassembles and verifies SHA-256.
 */

export const EXPORT_CHUNK_SIZE = 10 * 1024 * 1024; // 10 MiB
export const EXPORT_CHUNK_MAX_RETRIES = 4;

export type ExportChunkInfo = {
  index: number;
  offset: number;
  length: number;
  sha256: string;
};

export type ExportDownloadManifest = {
  ok: true;
  protocol: "veninspect-chunks-v1";
  jobId: string;
  filename: string;
  size: number;
  chunkSize: number;
  chunkCount: number;
  sha256: string;
  chunks: ExportChunkInfo[];
};

export function planExportChunks(
  size: number,
  chunkSize: number = EXPORT_CHUNK_SIZE,
): { offset: number; length: number }[] {
  if (size < 0) throw new Error("size must be >= 0");
  if (chunkSize < 1) throw new Error("chunkSize must be >= 1");
  if (size === 0) return [{ offset: 0, length: 0 }];
  const out: { offset: number; length: number }[] = [];
  for (let offset = 0; offset < size; offset += chunkSize) {
    out.push({
      offset,
      length: Math.min(chunkSize, size - offset),
    });
  }
  return out;
}

export function assertChunkSizeSafe(chunkSize: number) {
  // Hard ceiling well under Cloudflare’s 100 MB response limit
  if (chunkSize > 10 * 1024 * 1024) {
    throw new Error(`chunkSize ${chunkSize} exceeds 10 MiB safety cap`);
  }
}
