/** Short-lived capability tickets for admin-only uploads (multipart-safe). */

import {
  sessionSecret,
  signSession,
  verifySession,
} from "@/lib/session-token";

const TICKET_MAX_AGE_SEC = 60 * 60; // 1 hour

export type ImportTicketPayload = {
  sub: string;
  role: "ADMIN" | "INSPECTOR";
  name: string;
  username: string | null;
  exp: number;
  purpose: "asset-import";
};

/**
 * Sign an import ticket. Issued only from pages that already passed requireAdmin().
 * Sent as a header/query param so multipart Cookie quirks cannot block import.
 */
export async function signAssetImportTicket(user: {
  id: string;
  role: "ADMIN" | "INSPECTOR";
  name: string;
  username: string | null;
}): Promise<string> {
  // Reuse session HMAC format with a distinct purpose marker in `name`.
  // verifyAssetImportTicket checks purpose via a dedicated prefix in username slot
  // is awkward — instead embed purpose in the signed payload by piggybacking
  // on the existing signSession shape and validating role===ADMIN + fresh exp.
  return signSession(
    {
      sub: user.id,
      role: "ADMIN",
      name: `asset-import:${user.name}`,
      username: user.username,
      exp: Math.floor(Date.now() / 1000) + TICKET_MAX_AGE_SEC,
    },
    sessionSecret(),
  );
}

export async function verifyAssetImportTicket(
  token: string | null | undefined,
): Promise<{ userId: string; username: string | null; name: string } | null> {
  if (!token?.trim()) return null;
  const payload = await verifySession(token.trim(), sessionSecret());
  if (!payload) return null;
  if (payload.role !== "ADMIN") return null;
  if (!payload.name.startsWith("asset-import:")) return null;
  return {
    userId: payload.sub,
    username: payload.username,
    name: payload.name.slice("asset-import:".length),
  };
}
