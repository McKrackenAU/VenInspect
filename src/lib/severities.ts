import type { StorageSettings } from "@/lib/paths";
import { readStorageSettings, writeStorageSettings } from "@/lib/paths";
import {
  DEFAULT_SEVERITIES,
  LEGACY_SEVERITY_TO_CS,
  normalizeConditionState,
  defectMatchesConditionStates,
  type SeverityOption,
} from "@/lib/condition-state";

export type { SeverityOption };
export {
  DEFAULT_SEVERITIES,
  LEGACY_SEVERITY_TO_CS,
  normalizeConditionState,
  defectMatchesConditionStates,
};

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
