import type { StorageSettings } from "@/lib/paths";
import { readStorageSettings, writeStorageSettings } from "@/lib/paths";

export type DocumentTagOption = {
  value: string;
  label: string;
};

export const DEFAULT_DOCUMENT_TAGS: DocumentTagOption[] = [
  { value: "PRIOR_INSPECTION", label: "Prior inspection" },
  { value: "AS_BUILT", label: "As built" },
  { value: "CONSTRUCTION", label: "Construction" },
  { value: "DRAWING", label: "Drawing" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "OTHER", label: "Other" },
];

export function getDocumentTags(): DocumentTagOption[] {
  const settings = readStorageSettings();
  const list = settings.documentTags;
  if (!Array.isArray(list) || list.length === 0) return DEFAULT_DOCUMENT_TAGS;
  return list
    .map((t) => ({
      value: String(t.value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_"),
      label: String(t.label ?? t.value ?? "").trim(),
    }))
    .filter((t) => t.value && t.label);
}

export function saveDocumentTags(options: DocumentTagOption[]) {
  const cleaned = options
    .map((t) => ({
      value: t.value.trim().toUpperCase().replace(/\s+/g, "_"),
      label: t.label.trim(),
    }))
    .filter((t) => t.value && t.label);
  if (cleaned.length === 0) {
    throw new Error("At least one document tag is required");
  }
  writeStorageSettings({ documentTags: cleaned } satisfies Partial<StorageSettings>);
  return cleaned;
}

export function documentTagLabel(value: string): string {
  return getDocumentTags().find((t) => t.value === value)?.label ?? value;
}
