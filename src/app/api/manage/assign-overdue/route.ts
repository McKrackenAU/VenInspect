import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdminRole, isRootUsername } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Assign / reassign an overdue asset inspection from the live dashboard. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role, user.username)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    assetId?: string;
    level?: string;
    assignedToId?: string;
    existingAssignmentId?: string | null;
    dueDate?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const assetId = String(body.assetId ?? "");
  const level = String(body.level ?? "LEVEL_1")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  const assignedToId = String(body.assignedToId ?? "").trim();
  const existingAssignmentId = body.existingAssignmentId
    ? String(body.existingAssignmentId)
    : null;
  const dueDateRaw = String(body.dueDate ?? "").slice(0, 10);
  const dueDate = dueDateRaw
    ? new Date(dueDateRaw + "T12:00:00")
    : new Date();

  if (!assetId || !assignedToId) {
    return NextResponse.json(
      { error: "Asset and inspector required" },
      { status: 400 },
    );
  }

  const assignee = await prisma.user.findUnique({
    where: { id: assignedToId },
    select: { username: true },
  });
  if (!assignee || isRootUsername(assignee.username)) {
    return NextResponse.json(
      { error: "Cannot assign work to the root system account" },
      { status: 400 },
    );
  }

  if (existingAssignmentId) {
    await prisma.auditAssignment.update({
      where: { id: existingAssignmentId },
      data: {
        assignedToId,
        status: "ASSIGNED",
        dueDate,
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.auditAssignment.create({
      data: {
        assetId,
        level,
        dueDate,
        assignedToId,
        createdById: user.id,
        notes: "Assigned from admin live dashboard (overdue)",
        status: "ASSIGNED",
        updatedAt: new Date(),
      },
    });
  }

  await prisma.notification.create({
    data: {
      userId: assignedToId,
      title: "Audit assigned",
      message: `You have been assigned a ${level} audit (from overdue queue).`,
    },
  });

  revalidatePath("/manage");
  revalidatePath("/manage/schedule");
  revalidatePath("/");

  return NextResponse.json({ ok: true });
}
