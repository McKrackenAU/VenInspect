import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAppVersion, getConfiguredUpdateChannel } from "@/lib/version";
import { readUpdateStatus, requestUpdate } from "@/lib/update-status";

export const dynamic = "force-dynamic";

async function requireAdminApi() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function GET() {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    status: readUpdateStatus(),
    current: getAppVersion(),
  });
}

export async function POST(request: Request) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    channel?: string;
  };
  const channel =
    body.channel === "github" || body.channel === "gitea"
      ? body.channel
      : getConfiguredUpdateChannel();

  const current = readUpdateStatus();
  if (current.state === "running" || current.state === "requested") {
    return NextResponse.json(
      {
        ok: false,
        error: "An update is already in progress",
        status: current,
      },
      { status: 409 },
    );
  }

  requestUpdate({ channel, fromVersion: getAppVersion() });

  return NextResponse.json({
    ok: true,
    message:
      "Update requested. The updater will build in the background, then restart the service briefly.",
    status: readUpdateStatus(),
  });
}
