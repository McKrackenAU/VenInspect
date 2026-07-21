import type { StorageSettings } from "@/lib/paths";
import { readStorageSettings, writeStorageSettings } from "@/lib/paths";

export type InspectionTypeOption = {
  value: string;
  label: string;
  description: string;
  /** When true, non–Level-2-qualified inspectors need L2 approval on submit */
  requiresLevel2Approval?: boolean;
};

export const DEFAULT_INSPECTION_TYPES: InspectionTypeOption[] = [
  {
    value: "LEVEL_1",
    label: "Level 1",
    description: "Routine check (about every 3 years)",
  },
  {
    value: "LEVEL_2",
    label: "Level 2",
    description: "Detailed check — may need a Level 2 person to approve",
    requiresLevel2Approval: true,
  },
];

export function getInspectionTypes(): InspectionTypeOption[] {
  const settings = readStorageSettings();
  const list = settings.inspectionTypes;
  if (!Array.isArray(list) || list.length === 0) return DEFAULT_INSPECTION_TYPES;
  return list
    .map((t) => ({
      value: String(t.value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_"),
      label: String(t.label ?? t.value ?? "").trim(),
      description: String(t.description ?? "").trim(),
      requiresLevel2Approval: Boolean(t.requiresLevel2Approval),
    }))
    .filter((t) => t.value && t.label);
}

export function saveInspectionTypes(options: InspectionTypeOption[]) {
  const cleaned = options
    .map((t) => ({
      value: t.value.trim().toUpperCase().replace(/\s+/g, "_"),
      label: t.label.trim(),
      description: t.description.trim(),
      requiresLevel2Approval: Boolean(t.requiresLevel2Approval),
    }))
    .filter((t) => t.value && t.label);
  if (cleaned.length === 0) {
    throw new Error("At least one inspection type is required");
  }
  writeStorageSettings({
    inspectionTypes: cleaned,
  } satisfies Partial<StorageSettings>);
  return cleaned;
}

export function inspectionTypeLabel(value: string): string {
  return getInspectionTypes().find((t) => t.value === value)?.label ?? value.replaceAll("_", " ");
}
