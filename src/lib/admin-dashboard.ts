import { subDays, subHours } from "date-fns";
import { prisma } from "@/lib/db";
import {
  computeLevelSchedule,
  formatLevel,
  type ScheduleLevel,
} from "@/lib/inspection";
import { getAssetTypes, assetTypeLabel } from "@/lib/asset-types";
import {
  DASHBOARD_RANGES,
  type DashboardPayload,
  type DashboardRange,
} from "@/lib/admin-dashboard-shared";

export type { DashboardPayload, DashboardRange } from "@/lib/admin-dashboard-shared";
export {
  DASHBOARD_RANGES,
  parseDashboardRange,
  formatDashWhen,
  formatDashDay,
} from "@/lib/admin-dashboard-shared";

export function rangeStart(range: DashboardRange, now = new Date()): Date {
  switch (range) {
    case "24h":
      return subHours(now, 24);
    case "7d":
      return subDays(now, 7);
    case "30d":
      return subDays(now, 30);
    case "90d":
      return subDays(now, 90);
    case "365d":
      return subDays(now, 365);
    default:
      return subDays(now, 7);
  }
}

export async function loadAdminDashboard(
  range: DashboardRange,
): Promise<DashboardPayload> {
  const now = new Date();
  const from = rangeStart(range, now);
  const rangeLabel =
    DASHBOARD_RANGES.find((r) => r.value === range)?.label ?? range;

  const [
    completedRows,
    pendingApproval,
    drafts,
    recentSubmitted,
    inProgressRows,
    assets,
    openAssignments,
    inspectors,
  ] = await Promise.all([
    prisma.inspection.findMany({
      where: {
        status: { in: ["SUBMITTED", "PENDING_APPROVAL", "APPROVED"] },
        submittedAt: { gte: from },
      },
      select: {
        id: true,
        level: true,
        status: true,
        createdById: true,
        createdBy: { select: { name: true } },
        asset: { select: { type: true } },
      },
    }),
    prisma.inspection.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.inspection.count({ where: { status: "DRAFT" } }),
    prisma.inspection.findMany({
      where: {
        status: { in: ["SUBMITTED", "PENDING_APPROVAL", "APPROVED"] },
      },
      include: {
        asset: true,
        createdBy: true,
        _count: { select: { defects: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: 15,
    }),
    prisma.inspection.findMany({
      where: { status: { in: ["DRAFT", "REJECTED", "PENDING_APPROVAL"] } },
      include: { asset: true, createdBy: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.asset.findMany({
      include: {
        inspections: {
          where: {
            status: { in: ["SUBMITTED", "PENDING_APPROVAL", "APPROVED"] },
          },
          select: {
            level: true,
            status: true,
            inspectedAt: true,
            approvedAt: true,
          },
        },
      },
    }),
    prisma.auditAssignment.findMany({
      where: {
        status: { in: ["PLANNED", "ASSIGNED", "IN_PROGRESS"] },
      },
      include: { assignedTo: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["INSPECTOR", "ADMIN"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const byLevelMap = new Map<string, number>();
  const byAuditorMap = new Map<string, { name: string; count: number }>();
  const byTypeMap = new Map<string, number>();
  let submittedInRange = 0;
  let approvedInRange = 0;

  for (const row of completedRows) {
    byLevelMap.set(row.level, (byLevelMap.get(row.level) ?? 0) + 1);
    const a = byAuditorMap.get(row.createdById) ?? {
      name: row.createdBy.name,
      count: 0,
    };
    a.count += 1;
    byAuditorMap.set(row.createdById, a);
    byTypeMap.set(row.asset.type, (byTypeMap.get(row.asset.type) ?? 0) + 1);
    if (row.status === "APPROVED") approvedInRange += 1;
    else submittedInRange += 1;
  }

  const assignmentByKey = new Map<
    string,
    { id: string; assigneeName: string | null }
  >();
  for (const a of openAssignments) {
    assignmentByKey.set(`${a.assetId}:${a.level}`, {
      id: a.id,
      assigneeName: a.assignedTo?.name ?? null,
    });
  }

  const dueSoon: DashboardPayload["dueSoon"] = [];
  const overdue: DashboardPayload["overdue"] = [];

  for (const asset of assets) {
    for (const level of ["LEVEL_1", "LEVEL_2"] as ScheduleLevel[]) {
      const sched = computeLevelSchedule(asset, asset.inspections, level, now);
      if (!sched.nextDueAt || sched.daysUntilDue == null) continue;
      const key = `${asset.id}:${level}`;
      const existing = assignmentByKey.get(key);
      if (sched.status === "overdue") {
        overdue.push({
          assetId: asset.id,
          assetNumber: asset.assetNumber,
          roadName: asset.roadName,
          level,
          levelLabel: formatLevel(level),
          nextDueAt: sched.nextDueAt.toISOString(),
          daysOverdue: Math.abs(sched.daysUntilDue),
          existingAssignmentId: existing?.id ?? null,
          existingAssigneeName: existing?.assigneeName ?? null,
        });
      } else if (sched.status === "due_soon") {
        dueSoon.push({
          assetId: asset.id,
          assetNumber: asset.assetNumber,
          roadName: asset.roadName,
          level,
          levelLabel: formatLevel(level),
          nextDueAt: sched.nextDueAt.toISOString(),
          daysUntilDue: sched.daysUntilDue,
        });
      }
    }
  }

  overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
  dueSoon.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  const assetTypes = getAssetTypes();

  return {
    generatedAt: now.toISOString(),
    range,
    rangeLabel,
    stats: {
      completedInRange: completedRows.length,
      submittedInRange,
      approvedInRange,
      pendingApproval,
      draftsOpen: drafts,
      overdueAssets: overdue.length,
      dueSoonAssets: dueSoon.length,
      byLevel: [...byLevelMap.entries()]
        .map(([level, count]) => ({
          level,
          label: formatLevel(level),
          count,
        }))
        .sort((a, b) => b.count - a.count),
      byAuditor: [...byAuditorMap.entries()]
        .map(([userId, v]) => ({
          userId,
          name: v.name,
          count: v.count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12),
      byAssetType: [...byTypeMap.entries()]
        .map(([type, count]) => ({
          type,
          label:
            assetTypes.find((t) => t.value === type)?.label ??
            assetTypeLabel(type),
          count,
        }))
        .sort((a, b) => b.count - a.count),
    },
    recentlySubmitted: recentSubmitted.map((i) => ({
      id: i.id,
      titleLabel: i.titleLabel,
      assetNumber: i.asset.assetNumber,
      roadName: i.asset.roadName,
      level: i.level,
      levelLabel: formatLevel(i.level),
      status: i.status,
      auditorName: i.createdBy.name,
      at: i.submittedAt.toISOString(),
      defectCount: i._count.defects,
    })),
    inProgress: inProgressRows.map((i) => ({
      id: i.id,
      titleLabel: i.titleLabel,
      assetNumber: i.asset.assetNumber,
      roadName: i.asset.roadName,
      level: i.level,
      levelLabel: formatLevel(i.level),
      status: i.status,
      auditorName: i.createdBy.name,
      updatedAt: i.updatedAt.toISOString(),
    })),
    dueSoon: dueSoon.slice(0, 40),
    overdue: overdue.slice(0, 60),
    inspectors,
  };
}
