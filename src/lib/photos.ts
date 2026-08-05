import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  absolutePhotoPath,
  defectPhotoRelativePath,
  ensureDataDirs,
  sanitizePathSegment,
  getPhotoDir,
  readStorageSettings,
} from "@/lib/paths";
import {
  assertPhotoDirWritable,
  formatFsWriteError,
} from "@/lib/photo-resolve";

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

function appTimeZone() {
  return readStorageSettings().timezone?.trim() || "Australia/Melbourne";
}

/** Format taken-at as dd/MM/yyyy in the app timezone (not UTC host local). */
export function formatWatermarkDate(takenAt: Date): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-AU", {
      timeZone: appTimeZone(),
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(takenAt).map((p) => [p.type, p.value]),
    );
    return `${parts.day}/${parts.month}/${parts.year}`;
  } catch {
    const d = takenAt.getDate();
    const m = takenAt.getMonth() + 1;
    const y = takenAt.getFullYear();
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  }
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
          // Noon UTC avoids TZ day-shift when only the calendar date matters
          return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
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

/**
 * Build watermark SVG. Uses inline attributes (not CSS classes) so librsvg/sharp
 * on Linux reliably paints text. Baseline sits above the bottom edge so glyphs
 * are not clipped.
 */
function watermarkSvg(dateLabel: string, width: number, height: number) {
  const longEdge = Math.max(width, height);
  const fontSize = Math.min(36, Math.max(18, Math.round(longEdge * 0.028)));
  const strokeWidth = Math.max(3, Math.round(fontSize / 4));
  const padX = Math.max(10, Math.round(fontSize * 0.45));
  // Keep alphabetic baseline clear of the bottom so digits are fully visible
  const padY = Math.max(12, Math.round(fontSize * 0.55));
  const y = height - padY;
  const safe = dateLabel
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Dark pill behind white text for contrast on any photo
  const pillH = Math.round(fontSize * 1.45);
  const pillW = Math.round(fontSize * dateLabel.length * 0.62 + padX * 2);
  const pillX = Math.max(0, padX - 6);
  const pillY = Math.max(0, y - Math.round(fontSize * 0.95));
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="4" ry="4" fill="rgba(0,0,0,0.45)"/>
      <text x="${padX}" y="${y}"
        fill="#ffffff"
        stroke="#000000"
        stroke-width="${strokeWidth}"
        paint-order="stroke"
        font-size="${fontSize}"
        font-family="DejaVu Sans, Liberation Sans, Noto Sans, Arial, Helvetica, sans-serif"
        font-weight="700">${safe}</text>
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
  const dateLabel = formatWatermarkDate(takenAt);
  const overlay = watermarkSvg(dateLabel, info.width, info.height);
  const stamped = sharp(data).composite([
    {
      input: overlay,
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

  assertPhotoDirWritable();
  const abs = absolutePhotoPath(relativePath);
  try {
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, out);
  } catch (e) {
    throw formatFsWriteError(e, abs);
  }
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
  assertPhotoDirWritable();
  const abs = absolutePhotoPath(relativePath);
  try {
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, out);
  } catch (e) {
    throw formatFsWriteError(e, abs);
  }
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
  assertPhotoDirWritable();
  const relativePath = assetDocumentRelativePath(opts);
  const abs = path.join(getPhotoDir(), relativePath);
  try {
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, opts.buffer);
  } catch (e) {
    throw formatFsWriteError(e, abs);
  }
  return { relativePath, bytesWritten: opts.buffer.byteLength };
}
