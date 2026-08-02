import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveExistingPhotoPath } from "@/lib/photo-resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decodePart(part: string) {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: rawParts } = await context.params;
  if (!rawParts?.length) {
    return NextResponse.json(
      { error: "Not found" },
      {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const relative = rawParts.map(decodePart).join("/");
  try {
    const abs = resolveExistingPhotoPath(relative);
    if (!abs) {
      return NextResponse.json(
        { error: "Not found" },
        {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
    const data = await fs.readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    const type =
      ext === ".webp"
        ? "image/webp"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".png"
            ? "image/png"
            : "application/octet-stream";

    return new NextResponse(data, {
      headers: {
        "Content-Type": type,
        // Short revalidate — never immutable. A prior immutable year-long
        // Cache-Control could pin Cloudflare/browser to a cached 404.
        "Cache-Control": "private, max-age=3600, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Not found" },
      {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
