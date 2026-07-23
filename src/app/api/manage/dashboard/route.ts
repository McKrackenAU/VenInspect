import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  loadAdminDashboard,
  parseDashboardRange,
} from "@/lib/admin-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const range = parseDashboardRange(req.nextUrl.searchParams.get("range"));
  const data = await loadAdminDashboard(range);
  return NextResponse.json(data);
}
