import fs from "node:fs";
import path from "node:path";
import { getDataDir, getPhotoDir } from "@/lib/paths";

const MAX_ENTRIES = 250;

export type BrowseEntry = {
  name: string;
  path: string;
  writable: boolean;
};

export type BrowseResult = {
  roots: string[];
  path: string;
  parent: string | null;
  entries: BrowseEntry[];
  writable: boolean;
  exists: boolean;
};

function existsDir(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isWritableDir(p: string): boolean {
  try {
    fs.accessSync(p, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** Candidate roots for the folder picker (existing dirs only). */
export function listBrowseRoots(): string[] {
  const candidates: string[] = [];
  if (process.platform === "win32") {
    candidates.push(getDataDir(), path.parse(getDataDir()).root || "C:\\");
  } else {
    candidates.push(
      "/mnt",
      "/media",
      "/monolith",
      getDataDir(),
      path.dirname(getDataDir()),
      path.join(getDataDir(), "photos"),
    );
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of candidates) {
    if (!raw) continue;
    const resolved = path.resolve(raw);
    if (seen.has(resolved)) continue;
    if (!existsDir(resolved)) continue;
    seen.add(resolved);
    out.push(resolved);
  }
  return out;
}

function underAnyRoot(target: string, roots: string[]): boolean {
  const resolved = path.resolve(target);
  return roots.some((root) => {
    const r = path.resolve(root);
    return resolved === r || resolved.startsWith(r + path.sep);
  });
}

/** True if path is safe to list (absolute, no .. escape, under a browse root). */
export function isBrowsablePath(target: string, roots = listBrowseRoots()): boolean {
  if (!target?.trim()) return false;
  const resolved = path.resolve(target.trim());
  if (resolved.includes("\0")) return false;
  // Reject relative segments after resolve (should already be absolute)
  if (!path.isAbsolute(resolved)) return false;
  return underAnyRoot(resolved, roots);
}

export function browseStoragePath(requested?: string | null): BrowseResult {
  const roots = listBrowseRoots();
  const fallback = roots[0] ?? getDataDir();
  let current = requested?.trim()
    ? path.resolve(requested.trim())
    : path.resolve(fallback);

  if (!isBrowsablePath(current, roots)) {
    current = path.resolve(fallback);
  }

  const exists = existsDir(current);
  const parentRaw = path.dirname(current);
  const parent =
    parentRaw && parentRaw !== current && isBrowsablePath(parentRaw, roots)
      ? parentRaw
      : null;

  const entries: BrowseEntry[] = [];
  if (exists) {
    try {
      const names = fs.readdirSync(current);
      for (const name of names) {
        if (name.startsWith(".")) continue;
        const full = path.join(current, name);
        try {
          if (!fs.statSync(full).isDirectory()) continue;
        } catch {
          continue;
        }
        if (!isBrowsablePath(full, roots)) continue;
        entries.push({
          name,
          path: full,
          writable: isWritableDir(full),
        });
        if (entries.length >= MAX_ENTRIES) break;
      }
      entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    } catch {
      /* unreadable */
    }
  }

  return {
    roots,
    path: current,
    parent,
    entries,
    writable: exists ? isWritableDir(current) : false,
    exists,
  };
}

/** Suggest common mount points that already exist. */
export function suggestPhotoLocations(): { label: string; path: string }[] {
  const suggestions: { label: string; path: string }[] = [
    { label: "Default (DATA_DIR/photos)", path: path.join(getDataDir(), "photos") },
  ];
  const extras = [
    { label: "/mnt/veninspect-photos", path: "/mnt/veninspect-photos" },
    { label: "/mnt/truenas/VenInspect", path: "/mnt/truenas/VenInspect" },
    { label: "/monolith/VenInspect", path: "/monolith/VenInspect" },
    { label: "Current photo dir", path: getPhotoDir() },
  ];
  const seen = new Set(suggestions.map((s) => path.resolve(s.path)));
  for (const s of extras) {
    const resolved = path.resolve(s.path);
    if (seen.has(resolved)) continue;
    if (!existsDir(resolved)) continue;
    seen.add(resolved);
    suggestions.push({ label: s.label, path: resolved });
  }
  return suggestions;
}
