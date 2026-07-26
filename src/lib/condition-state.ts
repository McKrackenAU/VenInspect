/**
 * Client-safe condition-state helpers (no Node/fs imports).
 */

export type SeverityOption = {
  value: string;
  label: string;
  description?: string;
};

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
