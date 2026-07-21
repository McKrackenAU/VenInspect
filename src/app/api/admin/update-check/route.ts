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

export const dynamic = "force-dynamic";

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const channelParam = searchParams.get("channel") as UpdateChannel | null;
  const channel =
    channelParam === "github" || channelParam === "gitea"
      ? channelParam
      : getConfiguredUpdateChannel();

  const current = getAppVersion();
  const urls = remoteVersionUrls(channel);

  let remote: string | null = null;
  const fromVersion = await fetchText(urls.versionFile);
  if (fromVersion) remote = parseRemoteVersion(fromVersion);
  if (!remote) {
    const pkg = await fetchText(urls.packageJson);
    if (pkg) remote = parseRemoteVersion(pkg);
  }

  if (!remote) {
    return NextResponse.json({
      ok: false,
      current,
      currentLabel: formatAppVersion(current),
      channel,
      repoLabel: urls.repoLabel,
      error: `Could not reach ${urls.repoLabel}. Check network / UPDATE_CHANNEL.`,
    });
  }

  const cmp = compareSemver(remote, current);
  return NextResponse.json({
    ok: true,
    current,
    currentLabel: formatAppVersion(current),
    remote,
    remoteLabel: formatAppVersion(remote),
    channel,
    repoLabel: urls.repoLabel,
    updateAvailable: cmp > 0,
    sameVersion: cmp === 0,
    remoteIsOlder: cmp < 0,
  });
}
