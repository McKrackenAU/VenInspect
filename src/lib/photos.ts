import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { format } from "date-fns";
import {
  absolutePhotoPath,
  defectPhotoRelativePath,
  ensureDataDirs,
  sanitizePathSegment,
  getPhotoDir,
} from "@/lib/paths";

/** Field photos: long edge ≤ 1280px; prefer ≤ 450 KB; hard cap 700 KB. */
export const PHOTO_MAX_EDGE = 1280;
export const PHOTO_MIN_EDGE = 960;
export const PHOTO_WEBP_QUALITY = 72;
export const PHOTO_SOFT_OUTPUT_BYTES = 450 * 1024;
export const PHOTO_MAX_OUTPUT_BYTES = 700 * 1024;
export const PHOTO_MAX_INPUT_BYTES = 20 * 1024 * 1024;

function isHeicLike(buffer: Buffer, filename?: string | null) {
  const name = (filename ?? "").toLowerCase();
  if (name.endsWith(".heic") || name.endsWith(".heif")) return true;
  if (buffer.length < 12) return false;
  const brand = buffer.subarray(4, 12).toString("ascii");
  return brand.includes("heic") || brand.includes("heif") || brand.includes("mif1");
}

/** Prefer EXIF DateTimeOriginal → Digitized → file mtime → now. Date only. */
export async function resolveTakenDate(
  buffer: Buffer,
  fileLastModifiedMs?: number | null,
): Promise<Date> {
  try {
    const meta = await sharp(buffer, { failOn: "none" }).metadata();
    if (meta.exif) {
      const text = meta.exif.toString("binary");
      const m =
        text.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/) ??
        text.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        if (y >= 1990 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
          return new Date(y, mo - 1, d);
        }
      }
    }
  } catch {
    /* ignore */
  }

  if (fileLastModifiedMs && Number.isFinite(fileLastModifiedMs) && fileLastModifiedMs > 0) {
    return new Date(fileLastModifiedMs);
  }
  return new Date();
}

function watermarkSvg(dateLabel: string, width: number, height: number) {
  const longEdge = Math.max(width, height);
  const fontSize = Math.min(22, Math.max(14, Math.round(longEdge * 0.01)));
  const strokeWidth = Math.max(2, Math.round(fontSize / 5));
  const pad = Math.max(8, Math.round(fontSize * 0.6));
  const safe = dateLabel
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return Buffer.from(
    `<svg width="${width}" height="${height}">
      <style>
        .ts { fill: #ffffff; font-size: ${fontSize}px; font-family: Arial, Helvetica, sans-serif;
              font-weight: 600; paint-order: stroke; stroke: rgba(0,0,0,0.65); stroke-width: ${strokeWidth}px; }
      </style>
      <text x="${pad}" y="${height - pad}" class="ts">${safe}</text>
    </svg>`,
  );
}

async function loadRotated(buffer: Buffer) {
  return sharp(buffer, { failOn: "none", animated: false }).rotate();
}

async function encodeWithWatermark(
  buffer: Buffer,
  takenAt: Date,
  outFormat: "webp" | "jpeg",
  edge: number,
  quality: number,
): Promise<Buffer> {
  const base = await loadRotated(buffer);
  const resized = base.resize({
    width: edge,
    height: edge,
    fit: "inside",
    withoutEnlargement: true,
  });
  const { data, info } = await resized.toBuffer({ resolveWithObject: true });
  const dateLabel = format(takenAt, "dd/MM/yyyy");
  const stamped = sharp(data).composite([
    {
      input: watermarkSvg(dateLabel, info.width, info.height),
      top: 0,
      left: 0,
    },
  ]);
  if (outFormat === "webp") {
    return stamped.webp({ quality }).toBuffer();
  }
  return stamped.jpeg({ quality, mozjpeg: true }).toBuffer();
}

async function compressToMaxBytes(
  buffer: Buffer,
  takenAt: Date,
  prefer: "webp" | "jpeg",
): Promise<{ out: Buffer; ext: ".webp" | ".jpg" }> {
  let edge = PHOTO_MAX_EDGE;
  let quality = prefer === "webp" ? PHOTO_WEBP_QUALITY : 78;
  let last: Buffer | null = null;
  let ext: ".webp" | ".jpg" = prefer === "webp" ? ".webp" : ".jpg";

  for (let attempt = 0; attempt < 14; attempt++) {
    try {
      last = await encodeWithWatermark(buffer, takenAt, prefer, edge, quality);
      ext = prefer === "webp" ? ".webp" : ".jpg";
    } catch (err) {
      if (prefer === "webp") {
        prefer = "jpeg";
        quality = 78;
        continue;
      }
      throw err;
    }

    if (last.byteLength <= PHOTO_SOFT_OUTPUT_BYTES) {
      return { out: last, ext };
    }

    if (quality > 48) {
      quality -= 6;
    } else if (edge > PHOTO_MIN_EDGE) {
      edge = Math.max(PHOTO_MIN_EDGE, Math.round(edge * 0.9));
      quality = prefer === "webp" ? 68 : 72;
    } else if (quality > 36) {
      quality -= 4;
    } else if (last.byteLength <= PHOTO_MAX_OUTPUT_BYTES) {
      return { out: last, ext };
    } else {
      break;
    }
  }

  if (last && last.byteLength <= PHOTO_MAX_OUTPUT_BYTES) {
    return { out: last, ext };
  }

  last = await encodeWithWatermark(
    buffer,
    takenAt,
    "jpeg",
    Math.min(edge, PHOTO_MIN_EDGE),
    32,
  );
  if (last.byteLength > PHOTO_MAX_OUTPUT_BYTES) {
    throw new Error(
      "Could not compress photo under 700 KB. Try a smaller image or different format.",
    );
  }
  return { out: last, ext: ".jpg" };
}

export async function saveCompressedDefectPhoto(opts: {
  buffer: Buffer;
  roadName: string;
  assetNumber: string;
  folderKey: string;
  defectCode: string;
  originalName?: string | null;
  fileLastModifiedMs?: number | null;
}): Promise<{ relativePath: string; bytesWritten: number; takenAt: Date }> {
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

  const takenAt = await resolveTakenDate(opts.buffer, opts.fileLastModifiedMs);

  let out: Buffer;
  let ext: ".webp" | ".jpg";
  try {
    ({ out, ext } = await compressToMaxBytes(opts.buffer, takenAt, "webp"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isHeicLike(opts.buffer, opts.originalName)) {
      throw new Error(
        "This phone photo is HEIC/HEIF, which this server can’t decode. In iPhone Settings → Camera → Formats choose Most Compatible, or share/export as JPEG, then retry.",
      );
    }
    try {
      ({ out, ext } = await compressToMaxBytes(opts.buffer, takenAt, "jpeg"));
    } catch {
      throw new Error(
        `Could not process photo (${msg}). Try a smaller JPEG/PNG from the gallery.`,
      );
    }
  }

  if (ext === ".jpg") {
    relativePath = relativePath.replace(/\.webp$/i, ".jpg");
  }

  const abs = absolutePhotoPath(relativePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, out);
  return { relativePath, bytesWritten: out.byteLength, takenAt };
}

/** Generic compressed photo under an inspection folder (component notes, etc.). */
export async function saveCompressedInspectionPhoto(opts: {
  buffer: Buffer;
  roadName: string;
  assetNumber: string;
  folderKey: string;
  /** Relative file stem under the inspection folder, e.g. components/abutment_a/line1 */
  relativeStem: string;
  originalName?: string | null;
  fileLastModifiedMs?: number | null;
}): Promise<{ relativePath: string; bytesWritten: number; takenAt: Date }> {
  if (opts.buffer.byteLength === 0) throw new Error("Photo file is empty");
  if (opts.buffer.byteLength > PHOTO_MAX_INPUT_BYTES) {
    throw new Error("Photo too large (max 20 MB before compression)");
  }
  ensureDataDirs();
  const takenAt = await resolveTakenDate(opts.buffer, opts.fileLastModifiedMs);
  const { out, ext } = await compressToMaxBytes(opts.buffer, takenAt, "webp").catch(
    async (err) => {
      if (isHeicLike(opts.buffer, opts.originalName)) {
        throw new Error(
          "This phone photo is HEIC/HEIF, which this server can’t decode. Export as JPEG and retry.",
        );
      }
      try {
        return await compressToMaxBytes(opts.buffer, takenAt, "jpeg");
      } catch {
        throw err;
      }
    },
  );

  const stem = opts.relativeStem.replace(/^[/\\]+/, "").replace(/\.(webp|jpg|jpeg|png)$/i, "");
  const road = sanitizePathSegment(opts.roadName, "Unknown Road");
  const asset = sanitizePathSegment(opts.assetNumber, "Unknown");
  const relativePath = path
    .join(road, asset, opts.folderKey, `${stem}${ext}`)
    .replace(/\\/g, "/");
  const abs = absolutePhotoPath(relativePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, out);
  return { relativePath, bytesWritten: out.byteLength, takenAt };
}

export function assetDocumentRelativePath(opts: {
  roadName: string;
  assetNumber: string;
  documentId: string;
  originalFilename: string;
}) {
  const road = sanitizePathSegment(opts.roadName, "Unknown Road");
  const asset = sanitizePathSegment(opts.assetNumber, "Unknown");
  const safeName = sanitizePathSegment(opts.originalFilename, "document.pdf");
  return path
    .join(road, asset, "_documents", `${opts.documentId}_${safeName}`)
    .replace(/\\/g, "/");
}

export async function saveAssetDocumentFile(opts: {
  buffer: Buffer;
  roadName: string;
  assetNumber: string;
  documentId: string;
  originalFilename: string;
}): Promise<{ relativePath: string; bytesWritten: number }> {
  ensureDataDirs();
  const relativePath = assetDocumentRelativePath(opts);
  const abs = path.join(getPhotoDir(), relativePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, opts.buffer);
  return { relativePath, bytesWritten: opts.buffer.byteLength };
}
