import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { getAppVersion, getConfiguredUpdateChannel } from "@/lib/version";
import {
  isUpdateInProgress,
  readUpdateStatus,
  requestUpdate,
  resetUpdateState,
} from "@/lib/update-status";

export const dynamic = "force-dynamic";

async function requireAdminApi() {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role, user.username)) return null;
  return user;
}

export async function GET() {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    status: readUpdateStatus(),
    current: getAppVersion(),
    inProgress: isUpdateInProgress(),
  });
}

export async function POST(request: Request) {
  if (!(await requireAdminApi())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    channel?: string;
    action?: string;
  };

  if (body.action === "reset") {
    return NextResponse.json({
      ok: true,
      status: resetUpdateState(),
      message: "Update state reset",
    });
  }

  const channel =
    body.channel === "github" || body.channel === "gitea"
      ? body.channel
      : getConfiguredUpdateChannel();

  if (isUpdateInProgress()) {
    return NextResponse.json(
      {
        ok: false,
        error: "An update is already in progress",
        status: readUpdateStatus(),
      },
      { status: 409 },
    );
  }

  try {
    requestUpdate({ channel, fromVersion: getAppVersion() });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Could not queue update",
        status: readUpdateStatus(),
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    message:
      "Update requested. Only one updater will run (locked). Build happens in staging, then a short restart.",
    status: readUpdateStatus(),
  });
}
