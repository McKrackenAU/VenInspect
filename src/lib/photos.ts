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
export const PHOTO_MAX_INPUT_BYTES = 15 * 1024 * 1024;

export async function saveCompressedDefectPhoto(opts: {
  buffer: Buffer;
  roadName: string;
  assetNumber: string;
  folderKey: string;
  defectCode: string;
}): Promise<{ relativePath: string; bytesWritten: number }> {
  if (opts.buffer.byteLength > PHOTO_MAX_INPUT_BYTES) {
    throw new Error("Photo too large (max 15 MB before compression)");
  }

  ensureDataDirs();
  const relativePath = defectPhotoRelativePath({
    roadName: opts.roadName,
    assetNumber: opts.assetNumber,
    folderKey: opts.folderKey,
    defectCode: opts.defectCode,
  });
  const abs = absolutePhotoPath(relativePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });

  const out = await sharp(opts.buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: PHOTO_MAX_EDGE,
      height: PHOTO_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: PHOTO_WEBP_QUALITY })
    .toBuffer();

  await fs.writeFile(abs, out);
  return { relativePath, bytesWritten: out.byteLength };
}
