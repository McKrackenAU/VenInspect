/**
 * Resolve on-disk photo paths across current + legacy roots.
 * Survives PHOTO_DIR / settings.json moves without rewriting every DB row.
 */

import fs from "node:fs";
import path from "node:path";
import {
  getDataDir,
  getPhotoDir,
  readStorageSettings,
} from "@/lib/paths";

function normalizeRelative(relativePath: string): string {
  const normalized = relativePath.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (!normalized || normalized.includes("..")) {
    throw new Error("Invalid photo path");
  }
  return normalized;
}

/** Roots that may contain inspection photos (ordered preference). */
export function candidatePhotoRoots(): string[] {
  const roots: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const value = raw?.trim();
    if (!value) return;
    const resolved = path.resolve(value);
    if (seen.has(resolved)) return;
    seen.add(resolved);
    roots.push(resolved);
  };

  add(getPhotoDir());
  add(readStorageSettings().photoDir);
  add(process.env.PHOTO_DIR);
  // Old roots remembered when the active photo path was changed
  for (const prev of readStorageSettings().previousPhotoDirs ?? []) {
    add(prev);
  }
  add(path.join(getDataDir(), "photos"));
  add(path.join(getDataDir(), "uploads"));
  // Common Proxmox / NAS mounts from install docs
  for (const p of [
    "/mnt/veninspect-photos",
    "/mnt/truenas/VenInspect",
    "/monolith/VenInspect",
  ]) {
    try {
      if (fs.existsSync(p)) add(p);
    } catch {
      /* ignore */
    }
  }
  return roots;
}

function existsFile(abs: string): boolean {
  try {
    return fs.statSync(abs).isFile();
  } catch {
    return false;
  }
}

/**
 * Find a photo on disk for a stored relative path.
 * Tries each candidate root, then basename under the last path segments.
 */
export function resolveExistingPhotoPath(
  relativePath: string | null | undefined,
): string | null {
  if (!relativePath?.trim()) return null;
  let normalized: string;
  try {
    normalized = normalizeRelative(relativePath);
  } catch {
    return null;
  }

  const parts = normalized.split("/").filter(Boolean);
  const basename = parts[parts.length - 1]!;
  const tail2 = parts.slice(-2).join("/");
  const tail3 = parts.slice(-3).join("/");

  for (const root of candidatePhotoRoots()) {
    const direct = path.join(root, ...parts);
    if (existsFile(direct)) return direct;

    // Same relative path but extension swap (webp ↔ jpg)
    if (/\.webp$/i.test(basename)) {
      const jpg = path.join(
        root,
        ...parts.slice(0, -1),
        basename.replace(/\.webp$/i, ".jpg"),
      );
      if (existsFile(jpg)) return jpg;
    } else if (/\.jpe?g$/i.test(basename)) {
      const webp = path.join(
        root,
        ...parts.slice(0, -1),
        basename.replace(/\.jpe?g$/i, ".webp"),
      );
      if (existsFile(webp)) return webp;
    }
  }

  // Road/asset rename: search by asset/folderKey/file or folderKey/file
  for (const root of candidatePhotoRoots()) {
    for (const tail of [tail3, tail2, basename]) {
      if (!tail) continue;
      const hit = findFileByTail(root, tail, 6);
      if (hit) return hit;
    }
  }

  return null;
}

/** Bounded depth-first search for a relative tail under root. */
function findFileByTail(
  root: string,
  tail: string,
  maxDepth: number,
): string | null {
  const needle = tail.replace(/\\/g, "/");
  const stack: { dir: string; depth: number }[] = [{ dir: root, depth: 0 }];
  let checked = 0;
  const LIMIT = 8000;

  while (stack.length && checked < LIMIT) {
    const { dir, depth } = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      checked += 1;
      if (checked > LIMIT) break;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (depth < maxDepth) stack.push({ dir: full, depth: depth + 1 });
        continue;
      }
      if (!ent.isFile()) continue;
      const rel = path.relative(root, full).replace(/\\/g, "/");
      if (rel === needle || rel.endsWith(`/${needle}`)) return full;
    }
  }
  return null;
}

/** Absolute path for writing new photos (always current photo root). */
export function absolutePhotoPathForWrite(relativePath: string): string {
  const normalized = normalizeRelative(relativePath);
  return path.join(getPhotoDir(), ...normalized.split("/"));
}

/**
 * Sync photoPath from the first DefectPhoto when the legacy column is empty
 * or points at a missing file while gallery rows exist.
 */
export async function healDefectPhotoPath(defectId: string): Promise<{
  healed: boolean;
  photoPath: string | null;
}> {
  const { prisma } = await import("@/lib/db");
  const defect = await prisma.defect.findUnique({
    where: { id: defectId },
    include: {
      photos: { orderBy: { sortOrder: "asc" }, take: 20 },
    },
  });
  if (!defect) return { healed: false, photoPath: null };

  const galleryOk = defect.photos.find((p) => resolveExistingPhotoPath(p.path));
  if (galleryOk) {
    if (defect.photoPath !== galleryOk.path) {
      await prisma.defect.update({
        where: { id: defectId },
        data: { photoPath: galleryOk.path },
      });
      return { healed: true, photoPath: galleryOk.path };
    }
    return { healed: false, photoPath: defect.photoPath };
  }

  if (defect.photoPath && resolveExistingPhotoPath(defect.photoPath)) {
    return { healed: false, photoPath: defect.photoPath };
  }

  return { healed: false, photoPath: defect.photoPath };
}

export type PhotoHealthSummary = {
  checked: number;
  ok: number;
  missing: number;
  healed: number;
  roots: string[];
  samples: { path: string; status: "ok" | "missing" | "healed" }[];
};

/** Scan recent defects and heal photoPath when gallery files still exist. */
export async function scanAndHealPhotoLinks(opts?: {
  limit?: number;
  heal?: boolean;
}): Promise<PhotoHealthSummary> {
  const { prisma } = await import("@/lib/db");
  const limit = opts?.limit ?? 500;
  const heal = opts?.heal !== false;

  const defects = await prisma.defect.findMany({
    where: {
      OR: [
        { photoPath: { not: null } },
        { photos: { some: {} } },
      ],
      inspection: { deletedAt: null },
    },
    include: {
      photos: { orderBy: { sortOrder: "asc" }, take: 20 },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const summary: PhotoHealthSummary = {
    checked: 0,
    ok: 0,
    missing: 0,
    healed: 0,
    roots: candidatePhotoRoots(),
    samples: [],
  };

  for (const d of defects) {
    summary.checked += 1;
    const candidates = [
      ...d.photos.map((p) => p.path),
      d.photoPath,
      d.comparisonPhotoPath,
    ].filter((p): p is string => Boolean(p?.trim()));

    let found: string | null = null;
    for (const rel of candidates) {
      if (resolveExistingPhotoPath(rel)) {
        found = rel;
        break;
      }
    }

    if (found) {
      summary.ok += 1;
      if (heal && d.photoPath !== found && d.photos.some((p) => p.path === found)) {
        await prisma.defect.update({
          where: { id: d.id },
          data: { photoPath: found },
        });
        summary.healed += 1;
        if (summary.samples.length < 25) {
          summary.samples.push({ path: found, status: "healed" });
        }
      } else if (summary.samples.length < 8) {
        summary.samples.push({ path: found, status: "ok" });
      }
      continue;
    }

    summary.missing += 1;
    const samplePath = candidates[0] ?? "(none)";
    if (summary.samples.length < 25) {
      summary.samples.push({ path: samplePath, status: "missing" });
    }
  }

  return summary;
}
