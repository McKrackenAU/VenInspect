import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAdminSession, isRootUsername } from "@/lib/roles";
import {
  SESSION_COOKIE,
  sessionSecret,
  verifySession,
} from "@/lib/session-token";

const PUBLIC_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
  "/icons",
  "/manifest.webmanifest",
  "/_next",
  "/favicon",
];

/** Paths root may use outside /manage (APIs used by admin UI). */
function isRootAllowedPath(pathname: string): boolean {
  if (pathname.startsWith("/manage")) return true;
  if (pathname.startsWith("/api/manage")) return true;
  if (pathname.startsWith("/api/assets")) return true;
  if (pathname.startsWith("/api/uploads")) return true;
  if (pathname.startsWith("/api/admin")) return true;
  return false;
}

function isPublic(pathname: string): boolean {
  if (pathname === "/login") return true;
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isAdminApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/manage") ||
    pathname.startsWith("/api/assets/import") ||
    pathname.startsWith("/api/assets/registry-import")
  );
}

function readSessionTokenFromRequest(request: NextRequest): string | null {
  const fromJar = request.cookies.get(SESSION_COOKIE)?.value;
  if (fromJar) return fromJar;
  const header = request.headers.get("cookie") ?? "";
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

function isAssetImportPath(pathname: string): boolean {
  return (
    pathname === "/api/manage/asset-import" ||
    pathname === "/api/assets/import" ||
    pathname === "/api/assets/registry-import"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".webp")
  ) {
    return NextResponse.next();
  }

  // Asset import auth is enforced in the route handler (short grant / ticket /
  // session). Do not gate here — large uploads often lose Cookie headers, and
  // Edge middleware cannot read DATA_DIR grants.
  if (isAssetImportPath(pathname)) {
    return NextResponse.next();
  }

  const token = readSessionTokenFromRequest(request);
  const session = token ? await verifySession(token, sessionSecret()) : null;
  const admin = isAdminSession(session);
  const root = isRootUsername(session?.username);
  const isServerAction =
    request.headers.has("Next-Action") ||
    request.headers.has("next-action");

  // Bare host / IP with no session → login (clean URL, no ?next=/)
  if (!session && (pathname === "/" || pathname === "")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isPublic(pathname)) {
    if (
      session &&
      (pathname === "/login" || pathname === "/forgot-password")
    ) {
      const next = request.nextUrl.searchParams.get("next");
      const dest =
        next && next.startsWith("/") && !next.startsWith("/login")
          ? next
          : root
            ? "/manage"
            : "/";
      const safeDest =
        root && !dest.startsWith("/manage") ? "/manage" : dest;
      const url = request.nextUrl.clone();
      url.pathname = safeDest;
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!session) {
    if (isAdminApiPath(pathname) || isServerAction) {
      return NextResponse.json(
        { error: "Not signed in. Refresh the page and sign in again." },
        { status: 401 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") {
      url.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(url);
  }

  // System root: admin panel only (hidden from field portal)
  if (root && !isRootAllowedPath(pathname)) {
    if (pathname.startsWith("/api/") || isServerAction) {
      return NextResponse.json(
        { error: "Root account is limited to the admin portal." },
        { status: 403 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/manage";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Admin portal pages — never HTML-redirect server actions (breaks the
  // action protocol with "unexpected response from the server").
  if (pathname.startsWith("/manage") && !admin) {
    if (isServerAction) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Admin APIs: require a session here, but do NOT gate on session.role.
  // Route handlers re-check against the live DB role (avoids false 403s when
  // the signed cookie role is stale or multipart edge parsing is flaky).
  if (isAdminApiPath(pathname) && !session) {
    return NextResponse.json(
      { error: "Not signed in. Refresh the page and sign in again." },
      { status: 401 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
