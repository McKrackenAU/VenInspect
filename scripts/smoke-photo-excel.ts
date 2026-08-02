/**
 * Smoke: photo root fallbacks + WRU/DoT Excel sheet names.
 * Run: npx tsx scripts/smoke-photo-excel.ts
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import { planExportChunks, EXPORT_CHUNK_SIZE } from "../src/lib/export-chunks";
import { buildInspectionExcel } from "../src/lib/report-excel";
import { seedLevel2Template } from "../src/lib/inspection-templates";
import {
  photoPublicUrl,
  primaryDefectPhotoPath,
  PHOTO_URL_CACHE_BUST,
} from "../src/lib/photo-url";

function main() {
  // Photo URL cache bust
  const url = photoPublicUrl("Kororoit Creek Road/SN1/01012026/SN1-D001.webp");
  assert.match(url, /\/api\/uploads\/Kororoit%20Creek%20Road\//);
  assert.match(url, new RegExp(`[?&]v=${PHOTO_URL_CACHE_BUST}`));

  assert.equal(
    primaryDefectPhotoPath({
      photoPath: "legacy.webp",
      photos: [{ path: "gallery.webp" }],
    }),
    "gallery.webp",
  );
  assert.equal(
    primaryDefectPhotoPath({ photoPath: "legacy.webp", photos: [] }),
    "legacy.webp",
  );

  // Chunk size still capped
  for (const p of planExportChunks(EXPORT_CHUNK_SIZE * 3 + 1)) {
    assert.ok(p.length <= EXPORT_CHUNK_SIZE);
  }

  // Excel shaped like WRU / DoT workbook
  const template = seedLevel2Template();
  const buf = buildInspectionExcel({
    inspectionId: "test",
    level: "LEVEL_2",
    status: "SUBMITTED",
    inspectedAt: new Date("2026-07-19T02:00:00Z"),
    submittedAt: new Date("2026-07-19T03:00:00Z"),
    approvedAt: null,
    generalComments: "ok",
    titleLabel: "Test Road - SN1 - 19072026",
    inspectorName: "Inspector",
    approverName: null,
    asset: {
      assetNumber: "SN1",
      name: "Test",
      type: "BRIDGE",
      roadName: "Test Road",
      location: null,
      latitude: null,
      longitude: null,
      classification: null,
      subClassification: null,
      parentAssetName: null,
      parentAssetCode: null,
      parentChainage: null,
      notes: null,
    },
    categories: [],
    defects: [
      {
        defectCode: "SN1-D001",
        description: "Crack",
        comments: null,
        severity: "CS3",
        category: "Deck",
        subcategory: "Slab",
        photoPath: "Test Road/SN1/19072026/SN1-D001.webp",
        comparisonPhotoPath: null,
      },
    ],
    template,
    formPayload: {
      values: {
        si_inspector: "Alex",
        si_weather: "Fine",
        inv_structure_id: "SN1",
      },
      openSections: [],
      enabledOptionalPages: template.pages.map((p) => p.id),
    },
    generatedByName: "Smoke",
  });

  const wb = XLSX.read(buf, { type: "buffer" });
  assert.ok(wb.SheetNames.includes("Cover"));
  assert.ok(wb.SheetNames.includes("Structure Defect & Treatment"));
  assert.ok(
    wb.SheetNames.some((n) => /structure info/i.test(n)),
    `expected Structure info sheet, got ${wb.SheetNames.join(", ")}`,
  );

  // Resolve photo under alternate root (uploads legacy)
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "veninspect-photo-"));
  const prevData = process.env.DATA_DIR;
  const prevPhoto = process.env.PHOTO_DIR;
  try {
    process.env.DATA_DIR = dataDir;
    delete process.env.PHOTO_DIR;
    const uploads = path.join(dataDir, "uploads");
    const rel = "Old Road/SN9/01012026/SN9-D001.webp";
    const abs = path.join(uploads, ...rel.split("/"));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, Buffer.from("webp-smoke"));

    // Fresh import after env set (tsx may cache — clear if present)
    const modPath = require.resolve("../src/lib/photo-resolve");
    delete require.cache[modPath];
    const pathsMod = require.resolve("../src/lib/paths");
    delete require.cache[pathsMod];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveExistingPhotoPath } = require("../src/lib/photo-resolve") as {
      resolveExistingPhotoPath: (p: string) => string | null;
    };
    const hit = resolveExistingPhotoPath(rel);
    assert.ok(hit, "should find photo under DATA_DIR/uploads");
    assert.equal(fs.readFileSync(hit!).toString(), "webp-smoke");
  } finally {
    if (prevData === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = prevData;
    if (prevPhoto === undefined) delete process.env.PHOTO_DIR;
    else process.env.PHOTO_DIR = prevPhoto;
    fs.rmSync(dataDir, { recursive: true, force: true });
  }

  console.log(
    `OK photo-excel smoke: sheets=${wb.SheetNames.join("|")} cacheBust=${PHOTO_URL_CACHE_BUST}`,
  );
}

main();
