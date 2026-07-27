/** Short opaque grants for asset import (survives Cookie / long-ticket stripping). */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDataDir } from "@/lib/paths";

const GRANT_TTL_MS = 60 * 60 * 1000; // 1 hour
const GRANT_ID_RE = /^[a-f0-9]{32}$/;

type GrantRecord = {
  userId: string;
  username: string | null;
  exp: number;
  purpose: "asset-import";
};

function grantsDir() {
  return path.join(getDataDir(), "import-grants");
}

function grantPath(id: string) {
  return path.join(grantsDir(), `${id}.json`);
}

function pruneExpiredGrants() {
  const dir = grantsDir();
  if (!fs.existsSync(dir)) return;
  const now = Date.now();
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    try {
      const full = path.join(dir, name);
      const raw = JSON.parse(fs.readFileSync(full, "utf8")) as GrantRecord;
      if (!raw.exp || raw.exp < now) fs.unlinkSync(full);
    } catch {
      try {
        fs.unlinkSync(path.join(dir, name));
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Create a one-hour import grant after requireAdmin() on the Import page.
 * Returns a 32-char hex id safe for query strings (no HMAC length issues).
 */
export function createAssetImportGrant(user: {
  id: string;
  username: string | null;
}): string {
  pruneExpiredGrants();
  const id = crypto.randomBytes(16).toString("hex");
  fs.mkdirSync(grantsDir(), { recursive: true });
  const record: GrantRecord = {
    userId: user.id,
    username: user.username,
    exp: Date.now() + GRANT_TTL_MS,
    purpose: "asset-import",
  };
  fs.writeFileSync(grantPath(id), JSON.stringify(record), "utf8");
  return id;
}

export function verifyAssetImportGrant(
  id: string | null | undefined,
): { userId: string; username: string | null } | null {
  const grantId = (id ?? "").trim().toLowerCase();
  if (!GRANT_ID_RE.test(grantId)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(grantPath(grantId), "utf8")) as GrantRecord;
    if (raw.purpose !== "asset-import") return null;
    if (!raw.exp || raw.exp < Date.now()) {
      try {
        fs.unlinkSync(grantPath(grantId));
      } catch {
        /* ignore */
      }
      return null;
    }
    if (!raw.userId) return null;
    return { userId: raw.userId, username: raw.username ?? null };
  } catch {
    return null;
  }
}
