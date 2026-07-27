import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
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

async function readSessionTokenWithFallback(
  req: NextRequest,
): Promise<string | null> {
  const fromReq = readSessionToken(req);
  if (fromReq) return fromReq;
  try {
    const jar = await cookies();
    return jar.get(SESSION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
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
  const role: "ADMIN" | "INSPECTOR" =
    isAdminRole(user.role, user.username) ||
    isAdminRole(session?.role, session?.username)
      ? "ADMIN"
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
  const token = await readSessionTokenWithFallback(req);
  if (!token) return null;
  const session = await verifySession(token, sessionSecret());
  if (!session) return null;

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) {
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
  const token = await readSessionTokenWithFallback(req);
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

  // Prefer live DB role — session cookie can lag after a role promotion.
  const admin =
    (user ? isAdminRole(user.role, user.username) : false) ||
    isAdminRole(session.role, session.username) ||
    isRootUsername(session.username) ||
    isRootUsername(user?.username) ||
    normalizeRole(user?.role) === "ADMIN" ||
    normalizeRole(session.role) === "ADMIN";

  if (!admin) {
    return {
      error: Response.json(
        {
          error:
            "Admin access required. Your signed-in role is not Admin — open Manage → Users, set Role=Admin on your account, then sign out and back in.",
          debug: {
            sessionRole: session.role ?? null,
            dbRole: user?.role ?? null,
            username: user?.username ?? session.username ?? null,
          },
        },
        { status: 403 },
      ),
    };
  }

  if (user) {
    // Heal stale session cookies (DB says ADMIN, cookie still says INSPECTOR).
    // cookies().set is allowed in route handlers.
    if (
      session.role !== "ADMIN" &&
      isAdminRole(user.role, user.username)
    ) {
      try {
        const { createSessionCookie } = await import("@/lib/auth");
        await createSessionCookie({
          id: user.id,
          role: "ADMIN",
          name: user.name,
          username: user.username,
        });
      } catch {
        /* ignore — import can still proceed with DB role */
      }
    }
    return { user: toAuthUser(user, session) };
  }

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
