import path from "node:path";
import fs from "node:fs";

/**
 * All durable data lives under DATA_DIR so Proxmox LXC can mount a separate
 * disk/volume for growth (photos) without bloating the app CT rootfs.
 *
 * Layout:
 *   {DATA_DIR}/veninspect.db
 *   {DATA_DIR}/uploads/{assetNumber}/{inspectionId}/{defectCode}.webp
 */
export function getDataDir() {
  const configured = process.env.DATA_DIR?.trim();
  if (configured) return path.resolve(configured);
  return path.resolve(process.cwd(), "data");
}

export function getDatabaseFilePath() {
  return path.join(getDataDir(), "veninspect.db");
}

export function getDatabaseUrl() {
  const absolute = getDatabaseFilePath().replace(/\\/g, "/");
  return `file:${absolute}`;
}

export function getUploadsRoot() {
  return path.join(getDataDir(), "uploads");
}

/** Relative path stored in DB — never absolute host paths. */
export function defectPhotoRelativePath(
  assetNumber: string,
  inspectionId: string,
  defectCode: string,
) {
  const safeAsset = assetNumber.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeCode = defectCode.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.posix.join(safeAsset, inspectionId, `${safeCode}.webp`);
}

export function absoluteUploadPath(relativePath: string) {
  const normalized = relativePath.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (normalized.includes("..")) {
    throw new Error("Invalid upload path");
  }
  return path.join(getUploadsRoot(), ...normalized.split("/"));
}

export function ensureDataDirs() {
  fs.mkdirSync(getDataDir(), { recursive: true });
  fs.mkdirSync(getUploadsRoot(), { recursive: true });
}
