import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canViewInspection } from "@/lib/inspection-access";
import {
  parseComponentsJson,
  suggestCsFromDefects,
} from "@/lib/defect-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await context.params;
  const componentId = req.nextUrl.searchParams.get("componentId");
  if (!componentId) {
    return NextResponse.json({ error: "componentId required" }, { status: 400 });
  }

  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: {
      asset: true,
      defects: { where: { componentId } },
    },
  });
  if (!inspection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canViewInspection(user, inspection)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const comps = parseComponentsJson(inspection.asset.componentsJson);
  const comp = comps.find((c) => c.id === componentId);
  const qty = Number.parseFloat(String(comp?.qty ?? "")) || 0;
  const suggested = suggestCsFromDefects(
    qty,
    inspection.defects.map((d) => ({
      severity: d.severity,
      defectQty: d.defectQty,
    })),
  );
  return NextResponse.json(suggested);
}
