import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  absolutePhotoPath,
  defectPhotoRelativePath,
  ensureDataDirs,
} from "@/lib/paths";

/** Keep field photos small: long edge ≤ 1600px, WebP ~75 quality. */
export const PHOTO_MAX_EDGE = 1600;
export const PHOTO_WEBP_QUALITY = 75;
export const PHOTO_MAX_INPUT_BYTES = 20 * 1024 * 1024;

function isHeicLike(buffer: Buffer, filename?: string | null) {
  const name = (filename ?? "").toLowerCase();
  if (name.endsWith(".heic") || name.endsWith(".heif")) return true;
  // ftyp….heic / heif / mif1
  if (buffer.length < 12) return false;
  const brand = buffer.subarray(4, 12).toString("ascii");
  return brand.includes("heic") || brand.includes("heif") || brand.includes("mif1");
}

async function compressToWebp(buffer: Buffer) {
  return sharp(buffer, { failOn: "none", animated: false })
    .rotate()
    .resize({
      width: PHOTO_MAX_EDGE,
      height: PHOTO_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: PHOTO_WEBP_QUALITY })
    .toBuffer();
}

async function compressToJpeg(buffer: Buffer) {
  return sharp(buffer, { failOn: "none", animated: false })
    .rotate()
    .resize({
      width: PHOTO_MAX_EDGE,
      height: PHOTO_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

export async function saveCompressedDefectPhoto(opts: {
  buffer: Buffer;
  roadName: string;
  assetNumber: string;
  folderKey: string;
  defectCode: string;
  /** Original filename from the device (helps detect HEIC) */
  originalName?: string | null;
}): Promise<{ relativePath: string; bytesWritten: number }> {
  if (opts.buffer.byteLength === 0) {
    throw new Error("Photo file is empty");
  }
  if (opts.buffer.byteLength > PHOTO_MAX_INPUT_BYTES) {
    throw new Error("Photo too large (max 20 MB before compression)");
  }

  ensureDataDirs();
  let relativePath = defectPhotoRelativePath({
    roadName: opts.roadName,
    assetNumber: opts.assetNumber,
    folderKey: opts.folderKey,
    defectCode: opts.defectCode,
  });

  let out: Buffer;
  try {
    out = await compressToWebp(opts.buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isHeicLike(opts.buffer, opts.originalName)) {
      throw new Error(
        "This phone photo is HEIC/HEIF, which this server can’t decode. In iPhone Settings → Camera → Formats choose Most Compatible, or share/export as JPEG, then retry.",
      );
    }
    // Fallback JPEG path (some inputs fail WebP encode but decode OK)
    try {
      out = await compressToJpeg(opts.buffer);
      relativePath = relativePath.replace(/\.webp$/i, ".jpg");
    } catch {
      throw new Error(
        `Could not process photo (${msg}). Try a smaller JPEG/PNG from the gallery.`,
      );
    }
  }

  const abs = absolutePhotoPath(relativePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, out);
  return { relativePath, bytesWritten: out.byteLength };
}
