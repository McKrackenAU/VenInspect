import type { StorageSettings } from "@/lib/paths";
import { readStorageSettings, writeStorageSettings } from "@/lib/paths";

export type AssetTypeOption = {
  value: string;
  label: string;
  description?: string;
};

export const DEFAULT_ASSET_TYPES: AssetTypeOption[] = [
  { value: "BRIDGE", label: "Bridge", description: "Bridges and major structures" },
  { value: "DRAINAGE", label: "Drainage / culvert", description: "Culverts and drainage assets" },
  {
    value: "NOISE_WALL",
    label: "Noise wall",
    description: "Noise walls and acoustic barriers",
  },
];

export function getAssetTypes(): AssetTypeOption[] {
  const settings = readStorageSettings();
  const list = settings.assetTypes;
  if (!Array.isArray(list) || list.length === 0) return DEFAULT_ASSET_TYPES;
  return list
    .map((t) => ({
      value: String(t.value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_"),
      label: String(t.label ?? t.value ?? "").trim(),
      description: String(t.description ?? "").trim(),
    }))
    .filter((t) => t.value && t.label);
}

export function saveAssetTypes(options: AssetTypeOption[]) {
  const cleaned = options
    .map((t) => ({
      value: t.value.trim().toUpperCase().replace(/\s+/g, "_"),
      label: t.label.trim(),
      description: (t.description ?? "").trim(),
    }))
    .filter((t) => t.value && t.label);
  if (cleaned.length === 0) {
    throw new Error("At least one asset type is required");
  }
  writeStorageSettings({ assetTypes: cleaned } satisfies Partial<StorageSettings>);
  return cleaned;
}

export function assetTypeLabel(value: string): string {
  const opts = getAssetTypes();
  return opts.find((o) => o.value === value)?.label ?? value;
}

export function isKnownAssetType(value: string): boolean {
  return getAssetTypes().some((o) => o.value === value);
}
