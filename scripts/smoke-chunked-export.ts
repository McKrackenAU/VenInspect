/**
 * Smoke test for chunk planning + digest round-trip (no Next server required).
 * Run: npx tsx scripts/smoke-chunked-export.ts
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { planExportChunks, EXPORT_CHUNK_SIZE } from "../src/lib/export-chunks";

function sha256(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function main() {
  // Plan: empty, small, exact boundary, multi-chunk
  assert.deepEqual(planExportChunks(0, 10), [{ offset: 0, length: 0 }]);
  assert.deepEqual(planExportChunks(5, 10), [{ offset: 0, length: 5 }]);
  assert.deepEqual(planExportChunks(10, 10), [{ offset: 0, length: 10 }]);
  assert.deepEqual(planExportChunks(25, 10), [
    { offset: 0, length: 10 },
    { offset: 10, length: 10 },
    { offset: 20, length: 5 },
  ]);

  // Build a ~25 MiB buffer and verify chunk digests reassemble
  const chunkSize = EXPORT_CHUNK_SIZE;
  const size = chunkSize * 2 + 12345;
  const data = crypto.randomBytes(size);
  const plan = planExportChunks(size, chunkSize);
  assert.equal(plan.length, 3);

  const digests = plan.map(({ offset, length }) =>
    sha256(data.subarray(offset, offset + length)),
  );
  const whole = sha256(data);

  const parts = plan.map(({ offset, length }) =>
    data.subarray(offset, offset + length),
  );
  const reassembled = Buffer.concat(parts);
  assert.equal(reassembled.length, size);
  assert.equal(sha256(reassembled), whole);

  // Each part must be ≤ 10 MiB
  for (const p of parts) {
    assert.ok(p.length <= EXPORT_CHUNK_SIZE, `chunk ${p.length} too large`);
  }

  // Atomic write pattern used by writeClientExportZip
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "veninspect-chunks-"));
  const finalPath = path.join(dir, "pack.zip");
  const tmpPath = `${finalPath}.tmp`;
  fs.writeFileSync(tmpPath, data);
  fs.renameSync(tmpPath, finalPath);
  assert.equal(fs.readFileSync(finalPath).length, size);

  // Simulate chunk reads from disk without loading whole file into one go conceptually
  const fd = fs.openSync(finalPath, "r");
  try {
    for (let i = 0; i < plan.length; i++) {
      const { offset, length } = plan[i]!;
      const buf = Buffer.alloc(length);
      const n = fs.readSync(fd, buf, 0, length, offset);
      assert.equal(n, length);
      assert.equal(sha256(buf), digests[i]);
    }
  } finally {
    fs.closeSync(fd);
  }

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(
    `OK chunked-export smoke: size=${size} chunks=${plan.length} chunkSize=${chunkSize} sha256=${whole.slice(0, 12)}…`,
  );
}

main();
