import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { createSessionCookie } from "@/lib/auth";
import {
  exchangeMicrosoftCode,
  fetchMicrosoftProfile,
  getMicrosoftAuthConfig,
  microsoftRedirectUri,
  microsoftStateCookieName,
  resolveAppOrigin,
} from "@/lib/microsoft-auth";
import { getLoginMethodSettings } from "@/lib/auth-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function loginError(origin: string, code: string, next = "/") {
  const u = new URL("/login", origin);
  u.searchParams.set("error", code);
  if (next && next !== "/") u.searchParams.set("next", next);
  return NextResponse.redirect(u);
}

export async function GET(request: Request) {
  const origin = resolveAppOrigin(request);
  const methods = getLoginMethodSettings();
  if (!methods.allowMicrosoft) {
    return loginError(origin, "microsoft_disabled");
  }

  const config = getMicrosoftAuthConfig();
  if (!config) return loginError(origin, "microsoft_off");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const jar = await cookies();
  const raw = jar.get(microsoftStateCookieName())?.value;
  let stored: { state?: string; next?: string } = {};
  if (raw) {
    try {
      stored = JSON.parse(raw) as typeof stored;
    } catch {
      stored = {};
    }
  }
  const next =
    stored.next && stored.next.startsWith("/") ? stored.next : "/";

  jar.delete(microsoftStateCookieName());

  if (oauthError) {
    return loginError(origin, "microsoft_denied", next);
  }
  if (!code || !state || !stored.state || state !== stored.state) {
    return loginError(origin, "microsoft_state", next);
  }

  try {
    const redirectUri = microsoftRedirectUri(origin);
    const tokens = await exchangeMicrosoftCode({ config, code, redirectUri });
    const profile = await fetchMicrosoftProfile(tokens.accessToken);

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ microsoftOid: profile.oid }, { email: profile.email }],
      },
    });

    if (user) {
      if (!user.allowMicrosoftLogin) {
        return loginError(origin, "microsoft_user_disabled", next);
      }
      if (!user.microsoftOid || user.microsoftOid !== profile.oid) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            microsoftOid: profile.oid,
            ...(user.firstName ? {} : { firstName: profile.firstName }),
            ...(user.lastName ? {} : { lastName: profile.lastName }),
          },
        });
      }
    } else if (config.autoProvision) {
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          firstName: profile.firstName,
          lastName: profile.lastName,
          microsoftOid: profile.oid,
          role: "INSPECTOR",
          passwordHash: null,
          allowPasswordLogin: false,
          allowMicrosoftLogin: true,
        },
      });
    } else {
      return loginError(origin, "microsoft_unknown", next);
    }

    await createSessionCookie({
      id: user.id,
      role: user.role,
      name: user.name,
      username: user.username,
    });

    const dest =
      user.role !== "ADMIN" && next.startsWith("/manage") ? "/" : next;
    return NextResponse.redirect(new URL(dest, origin));
  } catch (e) {
    console.error("[microsoft-auth]", e);
    return loginError(origin, "microsoft_failed", next);
  }
}
