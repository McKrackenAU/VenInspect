import path from "node:path";
import fs from "node:fs";
import { format } from "date-fns";

/**
 * Durable storage layout (Proxmox-friendly):
 *
 *   {DATA_DIR}/veninspect.db          — lightweight SQLite (main / small disk)
 *   {DATA_DIR}/settings.json          — optional runtime overrides (e.g. photoDir)
 *   {PHOTO_DIR}/...                   — compressed photos (can be a large passthrough disk)
 *
 * PHOTO_DIR defaults to `{DATA_DIR}/photos` when unset — single-disk installs just work.
 * Set PHOTO_DIR=/mnt/photos (or via Management → Storage) for a separate volume.
 *
 * Inspection photo folders:
 *   {PHOTO_DIR}/{Road}/{AssetCode}/{DDMMYYYY}/defect.webp
 *   or …/{DDMMYYYY-HHmmss}/ when multiple inspections that day
 */

export type StorageSettings = {
  photoDir?: string;
  /** Admin-customisable defect severity dropdown options */
  severities?: { value: string; label: string }[];
};

function settingsPath() {
  return path.join(getDataDirFromEnvOnly(), "settings.json");
}

function getDataDirFromEnvOnly() {
  const configured = process.env.DATA_DIR?.trim();
  if (configured) return path.resolve(configured);
  return path.resolve(process.cwd(), "data");
}

export function readStorageSettings(): StorageSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), "utf8");
    return JSON.parse(raw) as StorageSettings;
  } catch {
    return {};
  }
}

export function writeStorageSettings(next: StorageSettings) {
  const dir = getDataDirFromEnvOnly();
  fs.mkdirSync(dir, { recursive: true });
  const merged: StorageSettings = { ...readStorageSettings(), ...next };
  // Only clear photoDir when the caller explicitly sets it (including empty string)
  if (Object.prototype.hasOwnProperty.call(next, "photoDir")) {
    if (!next.photoDir) delete merged.photoDir;
  }
  fs.writeFileSync(settingsPath(), JSON.stringify(merged, null, 2), "utf8");
  return merged;
}

export function getDataDir() {
  return getDataDirFromEnvOnly();
}

export function getDatabaseFilePath() {
  return path.join(getDataDir(), "veninspect.db");
}

export function getDatabaseUrl() {
  const absolute = getDatabaseFilePath().replace(/\\/g, "/");
  return `file:${absolute}`;
}

/** Photos root — env PHOTO_DIR wins, then settings.json, then {DATA_DIR}/photos */
export function getPhotoDir() {
  const fromEnv = process.env.PHOTO_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  const fromSettings = readStorageSettings().photoDir?.trim();
  if (fromSettings) return path.resolve(fromSettings);
  return path.join(getDataDir(), "photos");
}

/** @deprecated use getPhotoDir */
export function getUploadsRoot() {
  return getPhotoDir();
}

export function sanitizePathSegment(value: string, fallback = "Unknown") {
  const cleaned = value
    .trim()
    .replace(/[<>:"|?*\u0000-\u001f]/g, "")
    .replace(/[/\\]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, 120);
  return cleaned || fallback;
}

export function formatInspectionDateKey(when: Date) {
  return format(when, "ddMMyyyy");
}

export function formatInspectionTimeKey(when: Date) {
  return format(when, "HHmmss");
}

/**
 * Human label: "Kororoit Creek Road - SN1234 - 19072026"
 * or with time when disambiguating: "… - 19072026 14:30:52"
 */
export function buildInspectionLabel(opts: {
  roadName: string;
  assetNumber: string;
  at: Date;
  includeTime?: boolean;
}) {
  const road = opts.roadName.trim() || "Unknown Road";
  const date = format(opts.at, "ddMMyyyy");
  if (opts.includeTime) {
    return `${road} - ${opts.assetNumber} - ${date} ${format(opts.at, "HH:mm:ss")}`;
  }
  return `${road} - ${opts.assetNumber} - ${date}`;
}

/** Folder key under the asset: DDMMYYYY or DDMMYYYY-HHmmss */
export function allocateInspectionFolderKey(
  at: Date,
  existingKeys: string[],
): { folderKey: string; includeTimeInLabel: boolean } {
  const dateKey = formatInspectionDateKey(at);
  const taken = new Set(existingKeys);
  if (!taken.has(dateKey) && ![...taken].some((k) => k.startsWith(`${dateKey}-`))) {
    return { folderKey: dateKey, includeTimeInLabel: false };
  }
  // Same day already used — include submission time
  let folderKey = `${dateKey}-${formatInspectionTimeKey(at)}`;
  let n = 1;
  while (taken.has(folderKey)) {
    folderKey = `${dateKey}-${formatInspectionTimeKey(at)}-${n}`;
    n += 1;
  }
  return { folderKey, includeTimeInLabel: true };
}

export function inspectionPhotoRelativeDir(opts: {
  roadName: string;
  assetNumber: string;
  folderKey: string;
}) {
  const road = sanitizePathSegment(opts.roadName, "Unknown-Road");
  const asset = sanitizePathSegment(opts.assetNumber, "Unknown-Asset");
  const key = sanitizePathSegment(opts.folderKey, "undated");
  return path.posix.join(road, asset, key);
}

export function defectPhotoRelativePath(opts: {
  roadName: string;
  assetNumber: string;
  folderKey: string;
  defectCode: string;
}) {
  const dir = inspectionPhotoRelativeDir(opts);
  const code = sanitizePathSegment(opts.defectCode, "defect").replace(/\s+/g, "");
  return path.posix.join(dir, `${code}.webp`);
}

export function absolutePhotoPath(relativePath: string) {
  const normalized = relativePath.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (normalized.includes("..")) {
    throw new Error("Invalid photo path");
  }
  return path.join(getPhotoDir(), ...normalized.split("/"));
}

/** @deprecated */
export function absoluteUploadPath(relativePath: string) {
  return absolutePhotoPath(relativePath);
}

export function ensureDataDirs() {
  fs.mkdirSync(getDataDir(), { recursive: true });
  fs.mkdirSync(getPhotoDir(), { recursive: true });
}

export function describeStorage() {
  return {
    dataDir: getDataDir(),
    photoDir: getPhotoDir(),
    photoDirSource: process.env.PHOTO_DIR?.trim()
      ? "env:PHOTO_DIR"
      : readStorageSettings().photoDir?.trim()
        ? "settings.json"
        : "default:{DATA_DIR}/photos",
    databaseFile: getDatabaseFilePath(),
  };
}
