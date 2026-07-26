import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { browseStoragePath, suggestPhotoLocations } from "@/lib/storage-browse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pathParam = req.nextUrl.searchParams.get("path");
  const browse = browseStoragePath(pathParam);
  return NextResponse.json({
    ok: true,
    ...browse,
    suggestions: suggestPhotoLocations(),
    envLocked: Boolean(process.env.PHOTO_DIR?.trim()),
  });
}
