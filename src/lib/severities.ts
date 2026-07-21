import type { StorageSettings } from "@/lib/paths";
import { readStorageSettings, writeStorageSettings } from "@/lib/paths";

export type SeverityOption = {
  value: string;
  label: string;
};

export const DEFAULT_SEVERITIES: SeverityOption[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

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
    }))
    .filter((s) => s.value && s.label);
}

export function saveSeverityOptions(options: SeverityOption[]) {
  const cleaned = options
    .map((s) => ({
      value: s.value.trim().toUpperCase().replace(/\s+/g, "_"),
      label: s.label.trim(),
    }))
    .filter((s) => s.value && s.label);
  if (cleaned.length === 0) {
    throw new Error("At least one severity option is required");
  }
  writeStorageSettings({ severities: cleaned } satisfies Partial<StorageSettings>);
  return cleaned;
}

export function severityLabel(value: string): string {
  const opts = getSeverityOptions();
  return opts.find((o) => o.value === value)?.label ?? value;
}
