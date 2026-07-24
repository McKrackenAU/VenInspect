import { addYears, isBefore, differenceInCalendarDays, format } from "date-fns";
import type { Asset, Inspection } from "@/generated/prisma/client";
import {
  getInspectionTypes,
  inspectionTypeIntervalYears,
  inspectionTypeLabel,
} from "@/lib/inspection-types";

export type { PermitKey } from "@/lib/permits";
export { ASSET_PERMIT_FLAGS } from "@/lib/permits";

export type ScheduleStatus = "ok" | "due_soon" | "overdue" | "never";

/** Built-in schedule keys (asset still has level1/level2 interval fields as overrides). */
export type ScheduleLevel = "LEVEL_1" | "LEVEL_2";

export type LevelSchedule = {
  level: ScheduleLevel;
  intervalYears: number;
  lastInspectedAt: Date | null;
  nextDueAt: Date | null;
  status: ScheduleStatus;
  daysUntilDue: number | null;
};

export function latestApprovedForLevel(
  inspections: Pick<Inspection, "level" | "status" | "inspectedAt" | "approvedAt">[],
  level: string,
) {
  const completed = inspections
    .filter(
      (i) =>
        i.level === level &&
        (i.status === "APPROVED" ||
          i.status === "SUBMITTED" ||
          i.status === "PENDING_APPROVAL"),
    )
    .sort(
      (a, b) =>
        (b.approvedAt ?? b.inspectedAt).getTime() -
        (a.approvedAt ?? a.inspectedAt).getTime(),
    );
  return completed[0] ?? null;
}

export function computeLevelSchedule(
  asset: Pick<
    Asset,
    | "level1IntervalYears"
    | "level2IntervalYears"
    | "lastLevel1At"
    | "lastLevel2At"
  >,
  inspections: Pick<Inspection, "level" | "status" | "inspectedAt" | "approvedAt">[],
  level: ScheduleLevel,
  now = new Date(),
): LevelSchedule {
  // Prefer admin inspection-type interval; fall back to per-asset override fields.
  const fromType = inspectionTypeIntervalYears(level);
  const fromAsset =
    level === "LEVEL_1" ? asset.level1IntervalYears : asset.level2IntervalYears;
  const intervalYears =
    fromType > 0 ? fromType : fromAsset > 0 ? fromAsset : fromType;

  const last = latestApprovedForLevel(inspections, level);
  const fromInspection = last ? (last.approvedAt ?? last.inspectedAt) : null;
  const baseline =
    level === "LEVEL_1" ? asset.lastLevel1At ?? null : asset.lastLevel2At ?? null;

  let lastInspectedAt: Date | null = null;
  if (fromInspection && baseline) {
    lastInspectedAt =
      fromInspection.getTime() >= baseline.getTime() ? fromInspection : baseline;
  } else {
    lastInspectedAt = fromInspection ?? baseline;
  }

  if (!lastInspectedAt || intervalYears <= 0) {
    return {
      level,
      intervalYears,
      lastInspectedAt,
      nextDueAt: null,
      status: lastInspectedAt ? "ok" : "never",
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

/** Reactive list for Start inspection — from Admin settings (or defaults). */
export function getInspectionTypeOptions() {
  return getInspectionTypes();
}

export function formatLevel(level: string) {
  return inspectionTypeLabel(level);
}

export function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

/** Human label for schedule due state (safe for server components). */
export function formatNextDue(
  status: string,
  nextDueAt: Date | null,
): string | null {
  if (status === "overdue") return "Overdue";
  if (status === "due_soon" && nextDueAt) {
    return `Due soon (${format(nextDueAt, "dd MMM")})`;
  }
  return null;
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

export const NOISE_WALL_CATEGORIES = [
  { category: "Panels", subcategories: ["Face", "Joints", "Caps"] },
  { category: "Structure", subcategories: ["Posts", "Foundations", "Fixings"] },
  { category: "Surrounds", subcategories: ["Access", "Vegetation", "Drainage at toe"] },
] as const;

import { assetTypeLabel } from "@/lib/asset-types";

export function formatAssetType(type: string) {
  return assetTypeLabel(type);
}
