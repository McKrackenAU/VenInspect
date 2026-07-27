import fs from "node:fs";
import sharp from "sharp";
import { parseAssetWorkbook } from "../src/lib/asset-import";
import {
  xlsxBufferFromHeaders,
  ASSET_REGISTRY_TEMPLATE_HEADERS,
} from "../src/lib/import-templates";
import {
  formatWatermarkDate,
  saveCompressedInspectionPhoto,
} from "../src/lib/photos";

async function main() {
  const sample = [
    [
      "SN0001",
      "AV-10001",
      "Example Ped Underpass",
      "EXAMPLE RD",
      "BRIDGE",
      "PED_UNDERPASS",
      "Over creek",
      "-37.8",
      "144.9",
      "RMC 2",
      "12.5",
      "14.0",
      "",
    ],
  ];
  const buf = xlsxBufferFromHeaders(
    "Assets",
    ASSET_REGISTRY_TEMPLATE_HEADERS,
    sample,
  );
  const { rows, errors } = parseAssetWorkbook(buf);
  console.log("IMPORT rows", JSON.stringify(rows, null, 2));
  console.log("IMPORT errors", errors);
  if (!rows.length || rows[0]!.assetVisionId !== "AV-10001") {
    throw new Error("AV ID missing");
  }
  if (rows[0]!.subClassification !== "PED_UNDERPASS") {
    throw new Error("subclass missing");
  }
  if (rows[0]!.chainageFrom !== 12.5 || rows[0]!.chainageTo !== 14) {
    throw new Error("chainage missing");
  }

  const taken = new Date("2026-07-26T02:00:00.000Z");
  console.log("watermark date", formatWatermarkDate(taken));

  process.env.DATA_DIR = "/tmp/veninspect-test-data";
  const img = await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 3,
      background: { r: 180, g: 180, b: 180 },
    },
  })
    .png()
    .toBuffer();

  const saved = await saveCompressedInspectionPhoto({
    buffer: img,
    roadName: "Test Road",
    assetNumber: "SN0001",
    folderKey: "26072026",
    relativeStem: "form/test/wm",
  });
  console.log("saved", saved);
  const outPath = `/tmp/veninspect-test-data/photos/${saved.relativePath}`;
  const out = fs.readFileSync(outPath);
  const meta = await sharp(out).metadata();
  console.log("out meta", meta.width, meta.height, meta.format, out.length);

  // Copy for visual inspection artifact
  fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
  fs.copyFileSync(outPath, "/opt/cursor/artifacts/watermark-smoke.webp");
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
