import { NextResponse } from "next/server";
import {
  compareSemver,
  formatAppVersion,
  getAppVersion,
  getConfiguredUpdateChannel,
  parseRemoteVersion,
  remoteVersionUrls,
  type UpdateChannel,
} from "@/lib/version";
import { getCurrentUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

async function fetchText(url: string): Promise<string | null> {
  try {
    const headers: HeadersInit = {
      "User-Agent": "VenInspect-UpdateCheck",
      "Cache-Control": "no-cache",
    };
    // Contents API: ask for raw file bytes. Releases/tags endpoints stay JSON.
    if (url.includes("api.github.com") && url.includes("/contents/")) {
      headers.Accept = "application/vnd.github.raw";
    }
    // Bust CDN caches on raw.githubusercontent.com (often lags behind main)
    const bust = url.includes("?")
      ? `${url}&_=${Date.now()}`
      : `${url}?_=${Date.now()}`;
    const res = await fetch(bust, {
      cache: "no-store",
      headers,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    // tags list must stay JSON — don't use raw accept for that URL
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchRemoteVersion(channel: UpdateChannel): Promise<{
  remote: string | null;
  repoLabel: string;
  error?: string;
}> {
  const urls = remoteVersionUrls(channel);
  const candidates = [urls.versionFile, ...(urls.versionFileFallbacks ?? [])];

  for (const url of candidates) {
    const text = await fetchText(url);
    if (!text) continue;
    const remote = parseRemoteVersion(text);
    if (remote) return { remote, repoLabel: urls.repoLabel };
  }

  const pkg = await fetchText(urls.packageJson);
  if (pkg) {
    const remote = parseRemoteVersion(pkg);
    if (remote) return { remote, repoLabel: urls.repoLabel };
  }

  return {
    remote: null,
    repoLabel: urls.repoLabel,
    error: `Could not reach ${urls.repoLabel}`,
  };
}

type ChannelProbe = {
  channel: UpdateChannel;
  remote: string;
  repoLabel: string;
};

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role, user.username)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const channelParam = searchParams.get("channel");
  const preferred =
    channelParam === "github" || channelParam === "gitea"
      ? channelParam
      : getConfiguredUpdateChannel();
  // auto (default for UI): probe both and pick the newest reachable remote
  const mode = channelParam === "auto" || !channelParam ? "auto" : "single";

  const current = getAppVersion();

  if (mode === "single") {
    const result = await fetchRemoteVersion(preferred);
    if (!result.remote) {
      return NextResponse.json({
        ok: false,
        current,
        currentLabel: formatAppVersion(current),
        channel: preferred,
        repoLabel: result.repoLabel,
        error:
          result.error ??
          `Could not reach ${result.repoLabel}. Try the other update source.`,
      });
    }
    const cmp = compareSemver(result.remote, current);
    return NextResponse.json({
      ok: true,
      current,
      currentLabel: formatAppVersion(current),
      remote: result.remote,
      remoteLabel: formatAppVersion(result.remote),
      channel: preferred,
      repoLabel: result.repoLabel,
      updateAvailable: cmp > 0,
      sameVersion: cmp === 0,
      remoteIsOlder: cmp < 0,
    });
  }

  // Probe both channels; prefer the one with the newer version.
  const order: UpdateChannel[] =
    preferred === "github" ? ["github", "gitea"] : ["gitea", "github"];
  const probes: ChannelProbe[] = [];
  const errors: string[] = [];

  for (const ch of order) {
    const result = await fetchRemoteVersion(ch);
    if (result.remote) {
      probes.push({
        channel: ch,
        remote: result.remote,
        repoLabel: result.repoLabel,
      });
    } else if (result.error) {
      errors.push(result.error);
    }
  }

  if (probes.length === 0) {
    return NextResponse.json({
      ok: false,
      current,
      currentLabel: formatAppVersion(current),
      channel: preferred,
      error:
        errors.join(" · ") ||
        "Could not reach GitHub or Gitea. Check network / UPDATE_CHANNEL.",
    });
  }

  // Newest remote wins; on tie prefer the configured/preferred channel order
  let best = probes[0]!;
  for (const p of probes.slice(1)) {
    if (compareSemver(p.remote, best.remote) > 0) best = p;
  }

  const cmp = compareSemver(best.remote, current);
  return NextResponse.json({
    ok: true,
    current,
    currentLabel: formatAppVersion(current),
    remote: best.remote,
    remoteLabel: formatAppVersion(best.remote),
    channel: best.channel,
    repoLabel: best.repoLabel,
    updateAvailable: cmp > 0,
    sameVersion: cmp === 0,
    remoteIsOlder: cmp < 0,
    probed: probes.map((p) => ({
      channel: p.channel,
      remote: p.remote,
      remoteLabel: formatAppVersion(p.remote),
    })),
  });
}
