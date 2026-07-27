import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import {
  compareSemver,
  formatAppVersion,
  getAppVersion,
  getConfiguredUpdateChannel,
  listRemoteReleases,
  type UpdateChannel,
} from "@/lib/version";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role, user.username)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const channelParam = searchParams.get("channel");
  const channel: UpdateChannel =
    channelParam === "github" || channelParam === "gitea"
      ? channelParam
      : getConfiguredUpdateChannel();

  const current = getAppVersion();
  const result = await listRemoteReleases(channel);

  if (result.releases.length === 0) {
    return NextResponse.json({
      ok: false,
      current,
      currentLabel: formatAppVersion(current),
      channel,
      repoLabel: result.repoLabel,
      releases: [],
      error: result.error ?? "No releases found",
    });
  }

  const releases = result.releases.map((r) => {
    const cmp = compareSemver(r.version, current);
    return {
      ...r,
      label: formatAppVersion(r.version),
      isCurrent: cmp === 0,
      isNewer: cmp > 0,
      isOlder: cmp < 0,
    };
  });

  return NextResponse.json({
    ok: true,
    current,
    currentLabel: formatAppVersion(current),
    channel,
    repoLabel: result.repoLabel,
    releases,
  });
}
