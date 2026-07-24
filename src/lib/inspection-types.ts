import type { StorageSettings } from "@/lib/paths";
import { readStorageSettings, writeStorageSettings } from "@/lib/paths";
import {
  DEFAULT_INSPECTION_TYPES,
  normalizeIntervalYears,
  type InspectionTypeOption,
} from "@/lib/inspection-type-options";

export type { InspectionTypeOption } from "@/lib/inspection-type-options";
export {
  DEFAULT_INSPECTION_TYPES,
  defaultIntervalYearsForType,
  normalizeIntervalYears,
} from "@/lib/inspection-type-options";

function normalizeType(t: Partial<InspectionTypeOption>): InspectionTypeOption | null {
  const value = String(t.value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  const label = String(t.label ?? t.value ?? "").trim();
  if (!value || !label) return null;
  return {
    value,
    label,
    description: String(t.description ?? "").trim(),
    requiresLevel2Approval: Boolean(t.requiresLevel2Approval),
    intervalYears: normalizeIntervalYears(t.intervalYears, value),
  };
}

export function getInspectionTypes(): InspectionTypeOption[] {
  const settings = readStorageSettings();
  const list = settings.inspectionTypes;
  if (!Array.isArray(list) || list.length === 0) {
    return DEFAULT_INSPECTION_TYPES.map((t) => normalizeType(t)!);
  }
  return list.map((t) => normalizeType(t)).filter((t): t is InspectionTypeOption => t != null);
}

export function saveInspectionTypes(options: InspectionTypeOption[]) {
  const cleaned = options
    .map((t) => normalizeType(t))
    .filter((t): t is InspectionTypeOption => t != null);
  if (cleaned.length === 0) {
    throw new Error("At least one inspection type is required");
  }
  writeStorageSettings({
    inspectionTypes: cleaned,
  } satisfies Partial<StorageSettings>);
  return cleaned;
}

export function inspectionTypeLabel(value: string): string {
  return (
    getInspectionTypes().find((t) => t.value === value)?.label ??
    value.replaceAll("_", " ")
  );
}

/** Interval for a type code (settings → defaults). */
export function inspectionTypeIntervalYears(value: string): number {
  const found = getInspectionTypes().find((t) => t.value === value);
  if (found) return normalizeIntervalYears(found.intervalYears, value);
  return normalizeIntervalYears(undefined, value);
}
