import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { absolutePhotoPath } from "@/lib/paths";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await context.params;
  if (!parts?.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const relative = parts.join("/");
  try {
    const abs = absolutePhotoPath(relative);
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
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
