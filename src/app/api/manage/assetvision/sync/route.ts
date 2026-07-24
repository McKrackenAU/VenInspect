import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readStorageSettings } from "@/lib/paths";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stub sync — validates config and optionally fetches a health/list endpoint. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const s = readStorageSettings();
  const base = s.assetvisionBaseUrl?.trim();
  if (!base) {
    return NextResponse.json({
      message: "No Assetvision URL configured — offline mode.",
    });
  }

  try {
    const res = await fetch(base.replace(/\/$/, "") + "/health", {
      headers: s.assetvisionApiKey
        ? { Authorization: `Bearer ${s.assetvisionApiKey}` }
        : {},
      signal: AbortSignal.timeout(8000),
    });
    // If AV returns assets list elsewhere, wire here later.
    const assetCount = await prisma.asset.count();
    return NextResponse.json({
      message: `Reached ${base} (HTTP ${res.status}). Local assets: ${assetCount}. Batch export push is ready to wire to AV’s ingest API when documented.`,
    });
  } catch (e) {
    return NextResponse.json({
      message: `Could not reach Assetvision: ${e instanceof Error ? e.message : "error"}. Config saved for when the network path is available.`,
    });
  }
}
