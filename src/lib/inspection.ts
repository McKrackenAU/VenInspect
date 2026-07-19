import { addYears, isBefore, differenceInCalendarDays } from "date-fns";
import type { Asset, Inspection, InspectionLevel } from "@/generated/prisma/client";

export type ScheduleStatus = "ok" | "due_soon" | "overdue" | "never";

export type LevelSchedule = {
  level: InspectionLevel;
  intervalYears: number;
  lastInspectedAt: Date | null;
  nextDueAt: Date | null;
  status: ScheduleStatus;
  daysUntilDue: number | null;
};

export function latestApprovedForLevel(
  inspections: Pick<Inspection, "level" | "status" | "inspectedAt" | "approvedAt">[],
  level: InspectionLevel,
) {
  const approved = inspections
    .filter((i) => i.level === level && i.status === "APPROVED")
    .sort(
      (a, b) =>
        (b.approvedAt ?? b.inspectedAt).getTime() -
        (a.approvedAt ?? a.inspectedAt).getTime(),
    );
  return approved[0] ?? null;
}

export function computeLevelSchedule(
  asset: Pick<Asset, "level1IntervalYears" | "level2IntervalYears">,
  inspections: Pick<Inspection, "level" | "status" | "inspectedAt" | "approvedAt">[],
  level: InspectionLevel,
  now = new Date(),
): LevelSchedule {
  const intervalYears =
    level === "LEVEL_1" ? asset.level1IntervalYears : asset.level2IntervalYears;
  const last = latestApprovedForLevel(inspections, level);
  const lastInspectedAt = last ? (last.approvedAt ?? last.inspectedAt) : null;

  if (!lastInspectedAt) {
    return {
      level,
      intervalYears,
      lastInspectedAt: null,
      nextDueAt: null,
      status: "never",
      daysUntilDue: null,
    };
  }

  const nextDueAt = addYears(lastInspectedAt, intervalYears);
  const daysUntilDue = differenceInCalendarDays(nextDueAt, now);

  let status: ScheduleStatus = "ok";
  if (isBefore(nextDueAt, now)) status = "overdue";
  else if (daysUntilDue <= 90) status = "due_soon";

  return {
    level,
    intervalYears,
    lastInspectedAt,
    nextDueAt,
    status,
    daysUntilDue,
  };
}

export function formatLevel(level: InspectionLevel) {
  return level === "LEVEL_1" ? "Level 1" : "Level 2";
}

export function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

/** Next defect code for an asset within an inspection, e.g. SN2656-D003 */
export function nextDefectCode(assetNumber: string, existingCodes: string[]) {
  const prefix = `${assetNumber}-D`;
  let max = 0;
  for (const code of existingCodes) {
    if (!code.startsWith(prefix)) continue;
    const n = Number.parseInt(code.slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export const BRIDGE_CATEGORIES = [
  { category: "Approaches", subcategories: ["Approach A", "Approach B", "Barriers"] },
  {
    category: "Superstructure",
    subcategories: ["Deck", "Beams / Girders", "Expansion joints"],
  },
  {
    category: "Substructure",
    subcategories: ["Abutment A", "Abutment B", "Piers", "Bearings"],
  },
  { category: "Waterway", subcategories: ["Channel", "Scour", "Embankments"] },
] as const;

export const DRAINAGE_CATEGORIES = [
  { category: "Drainage", subcategories: ["Inlet", "Outlet", "Barrel", "Headwalls"] },
  { category: "Surrounds", subcategories: ["Embankment", "Access", "Vegetation"] },
] as const;
