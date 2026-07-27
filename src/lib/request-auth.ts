import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import type { AuthUser } from "@/lib/auth";
import { isAdminRole, isRootUsername, normalizeRole } from "@/lib/roles";
import {
  SESSION_COOKIE,
  sessionSecret,
  verifySession,
  type SessionPayload,
} from "@/lib/session-token";

/** Read session cookie even when NextRequest.cookies is empty (multipart edge cases). */
export function readSessionToken(req: NextRequest): string | null {
  const fromJar = req.cookies.get(SESSION_COOKIE)?.value;
  if (fromJar) return fromJar;
  const header = req.headers.get("cookie") ?? "";
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === SESSION_COOKIE) {
      const raw = rest.join("=");
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}

function toAuthUser(
  user: {
    id: string;
    email: string;
    username: string | null;
    name: string;
    role: string;
    level1Qualified: boolean;
    level2Qualified: boolean;
  },
  session?: SessionPayload | null,
): AuthUser {
  const role: "ADMIN" | "INSPECTOR" = isAdminRole(user.role, user.username) ||
    isAdminRole(session?.role, session?.username)
    ? "ADMIN"
    : normalizeRole(user.role) === "INSPECTOR"
      ? "INSPECTOR"
      : "INSPECTOR";

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

/**
 * Resolve the signed-in user from the incoming request cookie.
 * Prefer this in Route Handlers over `cookies()` / `getCurrentUser()`.
 */
export async function getUserFromRequest(
  req: NextRequest,
): Promise<AuthUser | null> {
  const token = readSessionToken(req);
  if (!token) return null;
  const session = await verifySession(token, sessionSecret());
  if (!session) return null;

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) {
    // Session valid but user row missing — still allow root/admin session for ops
    if (isAdminRole(session.role, session.username)) {
      return {
        id: session.sub,
        email: "",
        username: session.username,
        name: session.name,
        role: "ADMIN",
        level1Qualified: true,
        level2Qualified: true,
      };
    }
    return null;
  }

  return toAuthUser(user, session);
}

export async function requireAdminFromRequest(
  req: NextRequest,
): Promise<
  | { user: AuthUser; error?: undefined }
  | { user?: undefined; error: Response }
> {
  const token = readSessionToken(req);
  if (!token) {
    return {
      error: Response.json(
        { error: "Not signed in. Refresh the page and sign in again." },
        { status: 401 },
      ),
    };
  }

  const session = await verifySession(token, sessionSecret());
  if (!session) {
    return {
      error: Response.json(
        { error: "Session expired. Sign in again, then retry." },
        { status: 401 },
      ),
    };
  }

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  const admin =
    isAdminRole(session.role, session.username) ||
    (user ? isAdminRole(user.role, user.username) : false) ||
    isRootUsername(session.username) ||
    isRootUsername(user?.username);

  if (!admin) {
    return {
      error: Response.json(
        {
          error:
            "Admin access required. Sign out and sign back in with an admin account (role must be Admin).",
        },
        { status: 403 },
      ),
    };
  }

  if (user) return { user: toAuthUser(user, session) };

  return {
    user: {
      id: session.sub,
      email: "",
      username: session.username,
      name: session.name,
      role: "ADMIN",
      level1Qualified: true,
      level2Qualified: true,
    },
  };
}
