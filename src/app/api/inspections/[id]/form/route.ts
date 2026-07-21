import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canEditInspection } from "@/lib/inspection-access";
import {
  parseFormPayload,
  serializeFormPayload,
  type FormPayload,
} from "@/lib/inspection-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await context.params;
  let body: Partial<FormPayload>;
  try {
    body = (await req.json()) as Partial<FormPayload>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const inspection = await prisma.inspection.findUnique({ where: { id } });
  if (!inspection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canEditInspection(user, inspection)) {
    return NextResponse.json({ error: "Cannot edit" }, { status: 403 });
  }

  const current = parseFormPayload(inspection.formPayload);
  const next: FormPayload = {
    values:
      body.values && typeof body.values === "object"
        ? Object.fromEntries(
            Object.entries(body.values).map(([k, v]) => [
              k,
              v == null ? "" : String(v),
            ]),
          )
        : current.values,
    openSections: Array.isArray(body.openSections)
      ? body.openSections.map(String)
      : current.openSections,
    enabledOptionalPages: Array.isArray(body.enabledOptionalPages)
      ? body.enabledOptionalPages.map(String)
      : current.enabledOptionalPages,
  };

  await prisma.inspection.update({
    where: { id },
    data: { formPayload: serializeFormPayload(next) },
  });

  revalidatePath(`/inspections/${id}`);
  revalidatePath(`/inspections/${id}/report`);

  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { id } = await context.params;
  const inspection = await prisma.inspection.findUnique({ where: { id } });
  if (!inspection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(parseFormPayload(inspection.formPayload));
}
