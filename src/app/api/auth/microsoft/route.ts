import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getMicrosoftAuthConfig,
  microsoftAuthorizeUrl,
  microsoftRedirectUri,
  microsoftStateCookieName,
  resolveAppOrigin,
} from "@/lib/microsoft-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function randomState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function GET(request: Request) {
  const config = getMicrosoftAuthConfig();
  if (!config) {
    return NextResponse.redirect(
      new URL("/login?error=microsoft_off", request.url),
    );
  }

  const url = new URL(request.url);
  const nextRaw = url.searchParams.get("next") || "/";
  const next = nextRaw.startsWith("/") ? nextRaw : "/";
  const state = randomState();
  const origin = resolveAppOrigin(request);
  const redirectUri = microsoftRedirectUri(origin);

  const jar = await cookies();
  jar.set(microsoftStateCookieName(), JSON.stringify({ state, next }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "1",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(
    microsoftAuthorizeUrl({ config, redirectUri, state }),
  );
}
