import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readStorageSettings, writeStorageSettings } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: {
    timezone?: string;
    dateFormat?: string;
    timeFormat?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  writeStorageSettings({
    ...readStorageSettings(),
    ...(body.timezone != null ? { timezone: String(body.timezone) } : {}),
    ...(body.dateFormat != null ? { dateFormat: String(body.dateFormat) } : {}),
    ...(body.timeFormat != null ? { timeFormat: String(body.timeFormat) } : {}),
  });
  return NextResponse.json({ ok: true });
}
