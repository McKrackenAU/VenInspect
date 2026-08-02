/**
 * Copy / move inspection photo trees from an old root into the active PHOTO_DIR.
 * Preserves relative paths so DB rows keep working without rewrite.
 */

import fs from "node:fs";
import path from "node:path";
import {
  getPhotoDir,
  readStorageSettings,
  writeStorageSettings,
} from "@/lib/paths";

const PHOTO_EXT = /\.(webp|jpe?g|png|gif|heic|heif|pdf|bin)$/i;
const MAX_FILES = 200_000;

export type PhotoMigrateMode = "copy" | "move";

export type PhotoMigrateResult = {
  ok: true;
  from: string;
  to: string;
  mode: PhotoMigrateMode;
  dryRun: boolean;
  scanned: number;
  copied: number;
  skippedExisting: number;
  moved: number;
  errors: number;
  bytesCopied: number;
  samples: string[];
  errorSamples: string[];
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

/** Remember a root so resolveExistingPhotoPath can still find files there. */
export function rememberPreviousPhotoDir(oldRoot: string | null | undefined) {
  const resolved = oldRoot?.trim() ? path.resolve(oldRoot.trim()) : null;
  if (!resolved || !existsDir(resolved)) return;
  const current = path.resolve(getPhotoDir());
  if (resolved === current) return;
  const prev = readStorageSettings().previousPhotoDirs ?? [];
  const next = [
    resolved,
    ...prev.map((p) => path.resolve(p)).filter((p) => p !== resolved),
  ].slice(0, 12);
  writeStorageSettings({ previousPhotoDirs: next });
}

export function listRememberedPhotoDirs(): string[] {
  return (readStorageSettings().previousPhotoDirs ?? []).map((p) =>
    path.resolve(p),
  );
}

function walkFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length && out.length < MAX_FILES) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (out.length >= MAX_FILES) break;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        // Skip obvious junk
        if (ent.name === "." || ent.name === ".." || ent.name === "lost+found") {
          continue;
        }
        stack.push(full);
        continue;
      }
      if (!ent.isFile()) continue;
      if (!PHOTO_EXT.test(ent.name) && !ent.name.includes(".")) continue;
      out.push(full);
    }
  }
  return out;
}

export function migratePhotosToActiveRoot(opts: {
  from: string;
  to?: string;
  mode?: PhotoMigrateMode;
  dryRun?: boolean;
  /** Also register `from` as a previousPhotoDirs fallback */
  rememberSource?: boolean;
}): PhotoMigrateResult {
  const from = path.resolve(opts.from.trim());
  const to = path.resolve((opts.to ?? getPhotoDir()).trim());
  const mode: PhotoMigrateMode = opts.mode === "move" ? "move" : "copy";
  const dryRun = Boolean(opts.dryRun);

  if (!existsDir(from)) {
    throw new Error(`Source folder not found: ${from}`);
  }
  if (!existsDir(to)) {
    try {
      fs.mkdirSync(to, { recursive: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Could not create destination ${to}: ${msg}`);
    }
  }
  if (!isWritableDir(to)) {
    throw new Error(`Destination is not writable: ${to}`);
  }
  if (from === to) {
    throw new Error("Source and destination are the same folder");
  }
  // Prevent copying a parent into a child of itself
  if (to.startsWith(from + path.sep)) {
    throw new Error("Destination is inside the source folder");
  }
  if (from.startsWith(to + path.sep)) {
    throw new Error(
      "Source is inside the destination — pick the old root folder only",
    );
  }

  if (opts.rememberSource !== false) {
    rememberPreviousPhotoDir(from);
  }

  const files = walkFiles(from);
  const result: PhotoMigrateResult = {
    ok: true,
    from,
    to,
    mode,
    dryRun,
    scanned: files.length,
    copied: 0,
    skippedExisting: 0,
    moved: 0,
    errors: 0,
    bytesCopied: 0,
    samples: [],
    errorSamples: [],
  };

  for (const src of files) {
    const rel = path.relative(from, src);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
      result.errors += 1;
      if (result.errorSamples.length < 20) {
        result.errorSamples.push(`skip unsafe path: ${src}`);
      }
      continue;
    }
    const dest = path.join(to, rel);
    try {
      let destExists = false;
      let destSize = -1;
      try {
        const st = fs.statSync(dest);
        destExists = st.isFile();
        destSize = st.size;
      } catch {
        destExists = false;
      }
      const srcSize = fs.statSync(src).size;
      if (destExists && destSize === srcSize) {
        result.skippedExisting += 1;
        if (mode === "move" && !dryRun) {
          try {
            fs.unlinkSync(src);
            result.moved += 1;
          } catch (e) {
            result.errors += 1;
            if (result.errorSamples.length < 20) {
              result.errorSamples.push(
                `unlink after skip failed: ${rel} (${e instanceof Error ? e.message : e})`,
              );
            }
          }
        }
        continue;
      }

      if (dryRun) {
        result.copied += 1;
        result.bytesCopied += srcSize;
        if (result.samples.length < 25) result.samples.push(rel);
        continue;
      }

      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      result.copied += 1;
      result.bytesCopied += srcSize;
      if (result.samples.length < 25) result.samples.push(rel);

      if (mode === "move") {
        try {
          fs.unlinkSync(src);
          result.moved += 1;
        } catch (e) {
          result.errors += 1;
          if (result.errorSamples.length < 20) {
            result.errorSamples.push(
              `copied but could not remove source: ${rel} (${e instanceof Error ? e.message : e})`,
            );
          }
        }
      }
    } catch (e) {
      result.errors += 1;
      if (result.errorSamples.length < 20) {
        result.errorSamples.push(
          `${rel}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  return result;
}
