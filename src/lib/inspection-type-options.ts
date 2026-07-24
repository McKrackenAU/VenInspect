/** Shared inspection-type shape — safe for client bundles (no Node fs). */
export type InspectionTypeOption = {
  value: string;
  label: string;
  description: string;
  /** When true, non–Level-2-qualified inspectors need L2 approval on submit */
  requiresLevel2Approval?: boolean;
  /**
   * Years between inspections of this type (used for due / overdue).
   * 0 = not scheduled (no automatic due dates).
   */
  intervalYears?: number;
};

export const DEFAULT_INSPECTION_TYPES: InspectionTypeOption[] = [
  {
    value: "LEVEL_1",
    label: "Level 1",
    description: "Routine check",
    intervalYears: 3,
  },
  {
    value: "LEVEL_2",
    label: "Level 2",
    description: "Detailed check — may need a Level 2 person to approve",
    requiresLevel2Approval: true,
    intervalYears: 5,
  },
];

/** Default interval when a type has none stored yet (retroactive fill). */
export function defaultIntervalYearsForType(value: string): number {
  const code = value.trim().toUpperCase().replace(/\s+/g, "_");
  if (code === "LEVEL_2" || /LEVEL[_\s-]*2/.test(code)) return 5;
  if (code === "LEVEL_1" || /LEVEL[_\s-]*1/.test(code)) return 3;
  return 3;
}

export function normalizeIntervalYears(
  raw: unknown,
  typeValue: string,
): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (Number.isFinite(n) && n >= 0) return Math.min(100, Math.floor(n));
  return defaultIntervalYearsForType(typeValue);
}
