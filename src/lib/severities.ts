import type { StorageSettings } from "@/lib/paths";
import { readStorageSettings, writeStorageSettings } from "@/lib/paths";

export type SeverityOption = {
  value: string;
  label: string;
  /** Longer explanation shown in admin / export UI */
  description?: string;
};

/** Condition states 1–4 (replaces Low/Medium/High/Critical wording). */
export const DEFAULT_SEVERITIES: SeverityOption[] = [
  {
    value: "CS1",
    label: "Condition 1",
    description: "Not bad at all — no significant concern",
  },
  {
    value: "CS2",
    label: "Condition 2",
    description: "Small things to monitor",
  },
  {
    value: "CS3",
    label: "Condition 3",
    description: "Present — fixing would be preventive",
  },
  {
    value: "CS4",
    label: "Condition 4",
    description: "Bad — needs immediate attention",
  },
];

/** Map legacy severity codes into CS1–4 for filters. */
export const LEGACY_SEVERITY_TO_CS: Record<string, string> = {
  LOW: "CS1",
  MEDIUM: "CS2",
  HIGH: "CS3",
  CRITICAL: "CS4",
  CS1: "CS1",
  CS2: "CS2",
  CS3: "CS3",
  CS4: "CS4",
  CONDITION_1: "CS1",
  CONDITION_2: "CS2",
  CONDITION_3: "CS3",
  CONDITION_4: "CS4",
};

export function normalizeConditionState(value: string): string {
  const key = value.trim().toUpperCase().replace(/\s+/g, "_");
  return LEGACY_SEVERITY_TO_CS[key] ?? key;
}

export function getSeverityOptions(): SeverityOption[] {
  const settings = readStorageSettings();
  const list = settings.severities;
  if (!Array.isArray(list) || list.length === 0) return DEFAULT_SEVERITIES;
  return list
    .map((s) => ({
      value: String(s.value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_"),
      label: String(s.label ?? s.value ?? "").trim(),
      description: String(
        (s as { description?: string }).description ?? "",
      ).trim(),
    }))
    .filter((s) => s.value && s.label);
}

export function saveSeverityOptions(options: SeverityOption[]) {
  const cleaned = options
    .map((s) => ({
      value: s.value.trim().toUpperCase().replace(/\s+/g, "_"),
      label: s.label.trim(),
      description: (s.description ?? "").trim(),
    }))
    .filter((s) => s.value && s.label);
  if (cleaned.length === 0) {
    throw new Error("At least one condition state is required");
  }
  writeStorageSettings({ severities: cleaned } satisfies Partial<StorageSettings>);
  return cleaned;
}

export function severityLabel(value: string): string {
  const opts = getSeverityOptions();
  const norm = normalizeConditionState(value);
  return (
    opts.find((o) => o.value === value || o.value === norm)?.label ?? value
  );
}

/** Defect matches selected condition-state codes (supports legacy LOW/MEDIUM/…). */
export function defectMatchesConditionStates(
  severity: string,
  selected: string[],
): boolean {
  if (selected.length === 0) return true;
  const norm = normalizeConditionState(severity);
  const wanted = new Set(selected.map(normalizeConditionState));
  return wanted.has(norm) || wanted.has(severity.trim().toUpperCase());
}
