/**
 * Microsoft Entra ID (Azure AD) OIDC helpers for trial work-account login.
 *
 * Env (see .env.example):
 *   AUTH_MICROSOFT_ENTRA_ID_ID       — Application (client) ID
 *   AUTH_MICROSOFT_ENTRA_ID_SECRET   — Client secret
 *   AUTH_MICROSOFT_ENTRA_ID_ISSUER   — https://login.microsoftonline.com/<tenant>/v2.0
 *   APP_BASE_URL                     — optional public origin (e.g. http://192.168.13.10:8181)
 *   MICROSOFT_AUTO_PROVISION=1       — create inspector users on first Microsoft login
 */

export type MicrosoftAuthConfig = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  issuer: string;
  autoProvision: boolean;
};

const STATE_COOKIE = "vi_ms_oauth";

export function microsoftStateCookieName() {
  return STATE_COOKIE;
}

export function getMicrosoftAuthConfig(): MicrosoftAuthConfig | null {
  const clientId =
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim() ||
    process.env.MICROSOFT_CLIENT_ID?.trim() ||
    "";
  const clientSecret =
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim() ||
    process.env.MICROSOFT_CLIENT_SECRET?.trim() ||
    "";
  const issuerRaw =
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim() ||
    process.env.MICROSOFT_ISSUER?.trim() ||
    "";

  if (!clientId || !clientSecret || !issuerRaw) return null;

  const issuer = issuerRaw.replace(/\/+$/, "");
  const tenantMatch = /login\.microsoftonline\.com\/([^/]+)/i.exec(issuer);
  const tenantId =
    process.env.MICROSOFT_TENANT_ID?.trim() ||
    tenantMatch?.[1] ||
    "organizations";

  return {
    clientId,
    clientSecret,
    tenantId,
    issuer,
    autoProvision:
      process.env.MICROSOFT_AUTO_PROVISION?.trim() === "1" ||
      process.env.MICROSOFT_AUTO_PROVISION?.trim()?.toLowerCase() === "true",
  };
}

export function isMicrosoftAuthEnabled(): boolean {
  return getMicrosoftAuthConfig() != null;
}

export function microsoftAuthorizeUrl(opts: {
  config: MicrosoftAuthConfig;
  redirectUri: string;
  state: string;
}): string {
  const { config, redirectUri, state } = opts;
  const base = `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/authorize`;
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: "openid profile email User.Read",
    state,
  });
  return `${base}?${params.toString()}`;
}

export function microsoftTokenUrl(config: MicrosoftAuthConfig): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`;
}

export type MicrosoftProfile = {
  oid: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
};

export async function exchangeMicrosoftCode(opts: {
  config: MicrosoftAuthConfig;
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string; idToken?: string }> {
  const body = new URLSearchParams({
    client_id: opts.config.clientId,
    client_secret: opts.config.clientSecret,
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    scope: "openid profile email User.Read",
  });

  const res = await fetch(microsoftTokenUrl(opts.config), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Microsoft token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    access_token?: string;
    id_token?: string;
  };
  if (!json.access_token) throw new Error("Microsoft token response missing access_token");
  return { accessToken: json.access_token, idToken: json.id_token };
}

export async function fetchMicrosoftProfile(
  accessToken: string,
): Promise<MicrosoftProfile> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Microsoft Graph /me failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const me = (await res.json()) as {
    id?: string;
    mail?: string | null;
    userPrincipalName?: string | null;
    displayName?: string | null;
    givenName?: string | null;
    surname?: string | null;
  };

  const email = (me.mail || me.userPrincipalName || "").trim().toLowerCase();
  const oid = (me.id || "").trim();
  if (!oid || !email) {
    throw new Error("Microsoft profile missing id or email");
  }

  const name =
    me.displayName?.trim() ||
    [me.givenName, me.surname].filter(Boolean).join(" ").trim() ||
    email;

  return {
    oid,
    email,
    name,
    firstName: me.givenName?.trim() || null,
    lastName: me.surname?.trim() || null,
  };
}

/** Resolve public app origin for redirect_uri (LAN / tunnel friendly). */
export function resolveAppOrigin(request: Request): string {
  const configured = process.env.APP_BASE_URL?.trim() || process.env.AUTH_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const url = new URL(request.url);
  const xfProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const xfHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = xfHost || request.headers.get("host") || url.host;
  const proto = xfProto || url.protocol.replace(":", "") || "http";
  return `${proto}://${host}`;
}

export function microsoftRedirectUri(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/api/auth/microsoft/callback`;
}
