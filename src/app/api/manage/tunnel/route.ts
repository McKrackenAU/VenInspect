import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readStorageSettings, writeStorageSettings } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN" || user.username !== "root") {
    return NextResponse.json({ error: "Root only" }, { status: 403 });
  }
  let body: {
    cloudflareTunnelToken?: string;
    cloudflareTunnelHostname?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  writeStorageSettings({
    ...readStorageSettings(),
    cloudflareTunnelToken: String(body.cloudflareTunnelToken ?? ""),
    cloudflareTunnelHostname: String(body.cloudflareTunnelHostname ?? ""),
  });
  return NextResponse.json({
    ok: true,
    installHint:
      "On the LXC: sudo bash /opt/veninspect/deploy/install-cloudflared.sh then systemctl enable --now cloudflared",
  });
}
