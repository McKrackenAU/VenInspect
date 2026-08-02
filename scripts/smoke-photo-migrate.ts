/**
 * Smoke: copy photos from old root → new root, then resolve from new root.
 * Run: npx tsx scripts/smoke-photo-migrate.ts
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function main() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "veninspect-migrate-"));
  const dataDir = path.join(base, "data");
  const oldRoot = path.join(base, "old-photos");
  const newRoot = path.join(base, "bind-mount");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(newRoot, { recursive: true });

  const rel = "Test Road/SN100/01012026/SN100-D001.webp";
  const oldFile = path.join(oldRoot, ...rel.split("/"));
  fs.mkdirSync(path.dirname(oldFile), { recursive: true });
  fs.writeFileSync(oldFile, Buffer.from("photo-bytes"));

  const prevData = process.env.DATA_DIR;
  const prevPhoto = process.env.PHOTO_DIR;
  try {
    process.env.DATA_DIR = dataDir;
    process.env.PHOTO_DIR = newRoot;

    // Clear module cache so paths pick up env
    for (const key of Object.keys(require.cache)) {
      if (
        key.includes(`${path.sep}src${path.sep}lib${path.sep}paths`) ||
        key.includes(`${path.sep}src${path.sep}lib${path.sep}photo-`)
      ) {
        delete require.cache[key];
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { migratePhotosToActiveRoot, rememberPreviousPhotoDir } =
      require("../src/lib/photo-migrate") as typeof import("../src/lib/photo-migrate");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveExistingPhotoPath, candidatePhotoRoots } =
      require("../src/lib/photo-resolve") as typeof import("../src/lib/photo-resolve");

    // Before migrate: with remembered old root, resolve should find it
    rememberPreviousPhotoDir(oldRoot);
    assert.ok(
      candidatePhotoRoots().includes(path.resolve(oldRoot)),
      "old root should be a candidate",
    );
    const before = resolveExistingPhotoPath(rel);
    assert.ok(before?.startsWith(oldRoot), `expected old root hit, got ${before}`);

    const dry = migratePhotosToActiveRoot({
      from: oldRoot,
      dryRun: true,
      rememberSource: true,
    });
    assert.equal(dry.copied, 1);
    assert.ok(!fs.existsSync(path.join(newRoot, ...rel.split("/"))));

    const live = migratePhotosToActiveRoot({
      from: oldRoot,
      mode: "copy",
      dryRun: false,
    });
    assert.equal(live.copied, 1);
    assert.equal(live.errors, 0);
    const dest = path.join(newRoot, ...rel.split("/"));
    assert.ok(fs.existsSync(dest));
    assert.equal(fs.readFileSync(dest).toString(), "photo-bytes");

    // Prefer active root after migrate
    const after = resolveExistingPhotoPath(rel);
    assert.equal(after, dest);

    // Idempotent second copy
    const again = migratePhotosToActiveRoot({
      from: oldRoot,
      mode: "copy",
      dryRun: false,
    });
    assert.equal(again.copied, 0);
    assert.equal(again.skippedExisting, 1);

    console.log(
      `OK photo-migrate smoke: copied=${live.copied} dest=${dest}`,
    );
  } finally {
    if (prevData === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = prevData;
    if (prevPhoto === undefined) delete process.env.PHOTO_DIR;
    else process.env.PHOTO_DIR = prevPhoto;
    fs.rmSync(base, { recursive: true, force: true });
  }
}

main();
