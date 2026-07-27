/** Shared role / root helpers (safe for Edge middleware — no Node imports). */

export const ROOT_USERNAME = "root";

export function normalizeRole(role: unknown): "ADMIN" | "INSPECTOR" | string {
  return String(role ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

export function isRootUsername(username: string | null | undefined): boolean {
  return (username ?? "").trim().toLowerCase() === ROOT_USERNAME;
}

/** Session or DB role counts as platform admin (includes root username). */
export function isAdminRole(
  role: unknown,
  username?: string | null,
): boolean {
  if (isRootUsername(username)) return true;
  return normalizeRole(role) === "ADMIN";
}

export type SessionLike = {
  role?: unknown;
  username?: string | null;
};

export function isAdminSession(session: SessionLike | null | undefined): boolean {
  if (!session) return false;
  return isAdminRole(session.role, session.username);
}

/** Root is a system account — never offer it as an assignee / reviewer. */
export function isAssignableUsername(
  username: string | null | undefined,
): boolean {
  return !isRootUsername(username);
}

/** Prisma `where` fragment: exclude the root system user. */
export const excludeRootUserWhere: {
  OR: Array<{ username: null } | { username: { not: string } }>;
} = {
  OR: [{ username: null }, { username: { not: ROOT_USERNAME } }],
};
