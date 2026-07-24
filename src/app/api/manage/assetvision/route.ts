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
  let body: { assetvisionBaseUrl?: string; assetvisionApiKey?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  writeStorageSettings({
    ...readStorageSettings(),
    assetvisionBaseUrl: String(body.assetvisionBaseUrl ?? ""),
    assetvisionApiKey: String(body.assetvisionApiKey ?? ""),
  });
  return NextResponse.json({ ok: true });
}
