import type { StorageSettings } from "@/lib/paths";
import { readStorageSettings, writeStorageSettings } from "@/lib/paths";
import { DEFAULT_SEVERITIES } from "@/lib/severities";

export type ExportConfig = {
  /** Include full report PDF in Client Export ZIP */
  includePdf: boolean;
  /** Include WRU/DoT-shaped Report.xlsx in Client Export ZIP */
  includeExcel: boolean;
  /** Include defect photo folders */
  includePhotos: boolean;
  /** Include Photo_Index.xlsx */
  includePhotoIndex: boolean;
  /** Include comparison (prior) photos in defect folders */
  includeComparisonPhotos: boolean;
  /** Include form/section photos in PDF and Client Export */
  includeFormPhotos: boolean;
  /** Default condition states pre-checked for user exports (CS1–CS4) */
  defaultConditionStates: string[];
  /** When true, PDF export also respects condition-state filter from query */
  filterPdfByConditionStates: boolean;
};

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  includePdf: true,
  includeExcel: true,
  includePhotos: true,
  includePhotoIndex: true,
  includeComparisonPhotos: true,
  includeFormPhotos: true,
  defaultConditionStates: ["CS2", "CS3", "CS4"],
  filterPdfByConditionStates: true,
};

export function getExportConfig(): ExportConfig {
  const raw = readStorageSettings().exportConfig;
  if (!raw || typeof raw !== "object") return { ...DEFAULT_EXPORT_CONFIG };
  const defaults = DEFAULT_SEVERITIES.map((s) => s.value);
  const states = Array.isArray(raw.defaultConditionStates)
    ? raw.defaultConditionStates.map(String)
    : DEFAULT_EXPORT_CONFIG.defaultConditionStates;
  return {
    includePdf: raw.includePdf !== false,
    includeExcel: raw.includeExcel !== false,
    includePhotos: raw.includePhotos !== false,
    includePhotoIndex: raw.includePhotoIndex !== false,
    includeComparisonPhotos: raw.includeComparisonPhotos !== false,
    includeFormPhotos: raw.includeFormPhotos !== false,
    defaultConditionStates: states.length ? states : defaults.slice(1),
    filterPdfByConditionStates: raw.filterPdfByConditionStates !== false,
  };
}

export function saveExportConfig(config: ExportConfig) {
  const cleaned: ExportConfig = {
    includePdf: Boolean(config.includePdf),
    includeExcel: Boolean(config.includeExcel),
    includePhotos: Boolean(config.includePhotos),
    includePhotoIndex: Boolean(config.includePhotoIndex),
    includeComparisonPhotos: Boolean(config.includeComparisonPhotos),
    includeFormPhotos: Boolean(config.includeFormPhotos),
    defaultConditionStates: (config.defaultConditionStates ?? [])
      .map((s) => String(s).trim().toUpperCase())
      .filter(Boolean),
    filterPdfByConditionStates: Boolean(config.filterPdfByConditionStates),
  };
  if (cleaned.defaultConditionStates.length === 0) {
    cleaned.defaultConditionStates = [...DEFAULT_EXPORT_CONFIG.defaultConditionStates];
  }
  writeStorageSettings({
    exportConfig: cleaned,
  } satisfies Partial<StorageSettings>);
  return cleaned;
}
