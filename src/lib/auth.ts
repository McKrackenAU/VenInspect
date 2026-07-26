import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  sessionSecret,
  signSession,
  verifySession,
  type SessionPayload,
} from "@/lib/session-token";
import { hashPassword, verifyPassword } from "@/lib/passwords";
export type AuthUser = {
  id: string;
  email: string;
  username: string | null;
  name: string;
  role: "ADMIN" | "INSPECTOR";
  level1Qualified: boolean;
  level2Qualified: boolean;
};

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token, sessionSecret());
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    role: user.role,
    level1Qualified: user.level1Qualified,
    level2Qualified: user.level2Qualified,
  };
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

export async function createSessionCookie(user: {
  id: string;
  role: "ADMIN" | "INSPECTOR";
  name: string;
  username: string | null;
}) {
  const token = await signSession(
    {
      sub: user.id,
      role: user.role,
      name: user.name,
      username: user.username,
    },
    sessionSecret(),
  );
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "1",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function authenticateLogin(
  login: string,
  password: string,
): Promise<AuthUser | null> {
  const key = login.trim().toLowerCase();
  if (!key || !password) return null;

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: key }, { email: key }],
    },
  });
  if (!user?.passwordHash) return null;
  if (user.allowPasswordLogin === false) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    role: user.role,
    level1Qualified: user.level1Qualified,
    level2Qualified: user.level2Qualified,
  };
}

export { hashPassword };
