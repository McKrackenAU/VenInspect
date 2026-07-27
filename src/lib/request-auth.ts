import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import type { AuthUser } from "@/lib/auth";
import {
  SESSION_COOKIE,
  sessionSecret,
  verifySession,
} from "@/lib/session-token";

/**
 * Resolve the signed-in user from the incoming request cookie.
 * Prefer this in Route Handlers over `cookies()` / `getCurrentUser()` —
 * multipart uploads have been observed to miss the async cookie store
 * while `req.cookies` still has the session.
 */
export async function getUserFromRequest(
  req: NextRequest,
): Promise<AuthUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession(token, sessionSecret());
  if (!session) return null;

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) return null;

  // Prefer live DB role; fall back to session role if columns ever diverge
  const role =
    user.role === "ADMIN" || user.role === "INSPECTOR"
      ? user.role
      : session.role;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    role,
    level1Qualified: user.level1Qualified,
    level2Qualified: user.level2Qualified,
  };
}

export async function requireAdminFromRequest(
  req: NextRequest,
): Promise<
  | { user: AuthUser; error?: undefined }
  | { user?: undefined; error: Response }
> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return {
      error: Response.json(
        { error: "Not signed in. Refresh the page and sign in again." },
        { status: 401 },
      ),
    };
  }
  if (user.role !== "ADMIN") {
    return {
      error: Response.json(
        { error: "Admin access required to import assets." },
        { status: 403 },
      ),
    };
  }
  return { user };
}
