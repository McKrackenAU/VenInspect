import type { StorageSettings } from "@/lib/paths";
import { readStorageSettings, writeStorageSettings } from "@/lib/paths";

export type AssetSubClassOption = {
  value: string;
  label: string;
  /** When set, only offered for these asset types (empty = any). */
  forTypes?: string[];
  description?: string;
};

export const DEFAULT_ASSET_SUBCLASSES: AssetSubClassOption[] = [
  {
    value: "PED_UNDERPASS",
    label: "Ped underpass",
    forTypes: ["BRIDGE"],
    description: "Pedestrian underpass",
  },
  {
    value: "RAIL_UNDERPASS",
    label: "Rail underpass",
    forTypes: ["BRIDGE"],
    description: "Rail underpass",
  },
  {
    value: "VEHICLE_UNDERPASS",
    label: "Vehicle underpass",
    forTypes: ["BRIDGE"],
    description: "Vehicle underpass",
  },
];

export function getAssetSubClasses(): AssetSubClassOption[] {
  const settings = readStorageSettings();
  const list = settings.assetSubClasses;
  if (!Array.isArray(list) || list.length === 0) return DEFAULT_ASSET_SUBCLASSES;
  return list
    .map((t) => ({
      value: String(t.value ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_"),
      label: String(t.label ?? t.value ?? "").trim(),
      forTypes: Array.isArray(t.forTypes)
        ? t.forTypes.map((x) => String(x).trim().toUpperCase()).filter(Boolean)
        : undefined,
      description: String(t.description ?? "").trim(),
    }))
    .filter((t) => t.value && t.label);
}

export function saveAssetSubClasses(options: AssetSubClassOption[]) {
  const cleaned = options
    .map((t) => ({
      value: t.value.trim().toUpperCase().replace(/\s+/g, "_"),
      label: t.label.trim(),
      forTypes: t.forTypes?.map((x) => x.trim().toUpperCase()).filter(Boolean),
      description: (t.description ?? "").trim(),
    }))
    .filter((t) => t.value && t.label);
  writeStorageSettings({
    assetSubClasses: cleaned,
  } satisfies Partial<StorageSettings>);
  return cleaned;
}

export function assetSubClassLabel(value: string | null | undefined): string {
  if (!value) return "";
  const opts = getAssetSubClasses();
  return opts.find((o) => o.value === value)?.label ?? value;
}

/** Infer subclass from name / explicit text (e.g. import Type or Classification). */
export function inferAssetSubClass(
  name: string,
  explicit?: string | null,
): string | null {
  const e = (explicit ?? "").trim();
  if (e) {
    const key = e.toUpperCase().replace(/\s+/g, "_");
    const known = getAssetSubClasses().find(
      (o) =>
        o.value === key ||
        o.label.toLowerCase() === e.toLowerCase() ||
        o.value.replace(/_/g, " ").toLowerCase() === e.toLowerCase(),
    );
    if (known) return known.value;
    if (/ped/.test(e.toLowerCase()) && /underpass/.test(e.toLowerCase())) {
      return "PED_UNDERPASS";
    }
    if (/rail/.test(e.toLowerCase()) && /underpass/.test(e.toLowerCase())) {
      return "RAIL_UNDERPASS";
    }
    if (
      (/vehicle|road|veh/.test(e.toLowerCase()) && /underpass/.test(e.toLowerCase())) ||
      e.toLowerCase() === "underpass"
    ) {
      return /ped/.test(e.toLowerCase()) ? "PED_UNDERPASS" : "VEHICLE_UNDERPASS";
    }
  }

  const n = name.toLowerCase();
  if (/ped(estrian)?\s*underpass|underpass.*ped/.test(n)) return "PED_UNDERPASS";
  if (/rail\s*underpass|underpass.*rail/.test(n)) return "RAIL_UNDERPASS";
  if (/vehicle\s*underpass|road\s*underpass/.test(n)) return "VEHICLE_UNDERPASS";
  return null;
}
