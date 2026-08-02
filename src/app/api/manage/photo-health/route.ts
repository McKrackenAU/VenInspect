import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { scanAndHealPhotoLinks } from "@/lib/photo-resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  — scan photo links (no writes unless ?heal=1)
 * POST — scan + heal photoPath from gallery rows when files still exist
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const heal = req.nextUrl.searchParams.get("heal") === "1";
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "500");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, Math.floor(limitRaw)), 5000)
    : 500;
  const summary = await scanAndHealPhotoLinks({ limit, heal });
  return NextResponse.json({ ...summary, ok: true as const });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let limit = 500;
  try {
    const body = (await req.json()) as { limit?: number };
    if (typeof body.limit === "number") {
      limit = Math.min(Math.max(1, Math.floor(body.limit)), 5000);
    }
  } catch {
    /* empty body ok */
  }
  const summary = await scanAndHealPhotoLinks({ limit, heal: true });
  return NextResponse.json({ ...summary, ok: true as const });
}
