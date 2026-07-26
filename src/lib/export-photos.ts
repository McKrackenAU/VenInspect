import { normalizeConditionState } from "@/lib/condition-state";
import type { InspectionTemplate } from "@/lib/inspection-template-types";

export type ExportPhotoListItem = {
  key: string;
  label: string;
  detail?: string;
  severity?: string | null;
  /** Relative storage path (for ZIP packing) */
  path: string;
  /** general = form/section photos; defect = defect gallery */
  group: "general" | "defect";
  defectCode?: string;
  category?: string | null;
  subcategory?: string | null;
  description?: string;
  comments?: string | null;
  /** Capture date when known (ISO or Date serialised by callers) */
  takenAt?: string | null;
  createdAt?: string | null;
};

type DefectForExport = {
  id: string;
  defectCode: string;
  description: string;
  comments?: string | null;
  severity: string;
  category: string | null;
  subcategory: string | null;
  photoPath: string | null;
  comparisonPhotoPath: string | null;
  photos: {
    id: string;
    path: string;
    caption: string | null;
    kind: string;
    sortOrder: number;
    takenAt?: Date | string | null;
    createdAt?: Date | string | null;
  }[];
  createdAt?: Date | string | null;
};

type FormMedia = Record<
  string,
  {
    id: string;
    path: string;
    caption?: string;
    defectId?: string;
    takenAt?: string;
  }[]
>;

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function resolveFormMediaLabel(
  mediaKeyStr: string,
  caption: string | undefined,
  template: InspectionTemplate | null | undefined,
): { label: string; detail: string } {
  if (!template) {
    return {
      label: caption?.trim() || "General photo",
      detail: mediaKeyStr.includes("::") ? "Form field photo" : "Section photo",
    };
  }

  const [sectionId, fieldId] = mediaKeyStr.includes("::")
    ? (mediaKeyStr.split("::") as [string, string])
    : [mediaKeyStr, undefined];

  for (const page of template.pages) {
    for (const sec of page.sections) {
      if (sec.id !== sectionId) continue;
      if (fieldId) {
        const field = sec.fields.find((f) => f.id === fieldId);
        const fieldLabel = field?.label || fieldId;
        return {
          label: caption?.trim() || fieldLabel,
          detail: `${sec.title} · ${fieldLabel}`,
        };
      }
      return {
        label: caption?.trim() || sec.title,
        detail: `${page.title} · ${sec.title}`,
      };
    }
  }

  return {
    label: caption?.trim() || "General photo",
    detail: "Form photo",
  };
}

/**
 * Build the client-export / report photo pool.
 * General (form/section) photos first, then defect gallery photos.
 */
export function buildExportPhotoPool(
  defects: DefectForExport[],
  media: FormMedia,
  opts: {
    includeComparison: boolean;
    includeFormPhotos: boolean;
    template?: InspectionTemplate | null;
  },
): ExportPhotoListItem[] {
  const list: ExportPhotoListItem[] = [];
  const seenPaths = new Set<string>();

  // 1) General / section photos first (same pool the report PDF uses)
  if (opts.includeFormPhotos) {
    // Stable key order: section-level keys, then field keys (as Object.entries)
    const keys = Object.keys(media).sort((a, b) => {
      const aField = a.includes("::") ? 1 : 0;
      const bField = b.includes("::") ? 1 : 0;
      if (aField !== bField) return aField - bField;
      return a.localeCompare(b);
    });
    for (const sectionKey of keys) {
      const items = media[sectionKey] ?? [];
      for (const item of items) {
        if (!item.path || seenPaths.has(item.path)) continue;
        seenPaths.add(item.path);
        const { label, detail } = resolveFormMediaLabel(
          sectionKey,
          item.caption,
          opts.template,
        );
        list.push({
          key: `form:${item.id}`,
          label,
          detail,
          severity: null,
          path: item.path,
          group: "general",
          description: item.caption || label,
          takenAt: item.takenAt ?? null,
        });
      }
    }
  }

  // 2) Defect gallery photos
  for (const d of defects) {
    const pool = [...d.photos].sort((a, b) => a.sortOrder - b.sortOrder);
    if (pool.length > 0) {
      for (const p of pool) {
        if (!p.path || seenPaths.has(p.path)) continue;
        seenPaths.add(p.path);
        const kindLabel =
          p.kind && p.kind !== "other" ? p.kind : `photo ${p.sortOrder + 1}`;
        list.push({
          key: `defectphoto:${p.id}`,
          label: p.caption?.trim()
            ? `${d.defectCode} — ${p.caption.trim()}`
            : `${d.defectCode} (${kindLabel})`,
          detail: d.description,
          severity: d.severity,
          path: p.path,
          group: "defect",
          defectCode: d.defectCode,
          category: d.category,
          subcategory: d.subcategory,
          description: d.description,
          comments: d.comments ?? null,
          takenAt: toIso(p.takenAt),
          createdAt: toIso(p.createdAt),
        });
      }
    } else if (d.photoPath && !seenPaths.has(d.photoPath)) {
      seenPaths.add(d.photoPath);
      list.push({
        key: `defect:${d.id}:current`,
        label: `${d.defectCode} (current)`,
        detail: d.description,
        severity: d.severity,
        path: d.photoPath,
        group: "defect",
        defectCode: d.defectCode,
        category: d.category,
        subcategory: d.subcategory,
        description: d.description,
        comments: d.comments ?? null,
        createdAt: toIso(d.createdAt),
      });
    }

    if (
      opts.includeComparison &&
      d.comparisonPhotoPath &&
      !seenPaths.has(d.comparisonPhotoPath)
    ) {
      seenPaths.add(d.comparisonPhotoPath);
      list.push({
        key: `defect:${d.id}:comparison`,
        label: `${d.defectCode} (comparison)`,
        detail: d.description,
        severity: d.severity,
        path: d.comparisonPhotoPath,
        group: "defect",
        defectCode: d.defectCode,
        category: d.category,
        subcategory: d.subcategory,
        description: d.description,
        comments: d.comments ?? null,
        createdAt: toIso(d.createdAt),
      });
    }
  }

  return list;
}

/** Filter pool by selected condition states. General photos always kept. */
export function filterExportPhotosByCondition(
  photos: ExportPhotoListItem[],
  selected: string[],
): ExportPhotoListItem[] {
  if (selected.length === 0) return photos;
  const wanted = new Set(selected.map(normalizeConditionState));
  return photos.filter((p) => {
    if (p.group === "general" || p.severity == null || p.severity === "") {
      return true;
    }
    const norm = normalizeConditionState(p.severity);
    return wanted.has(norm) || wanted.has(p.severity.trim().toUpperCase());
  });
}

/**
 * Merge saved order with current pool.
 * Missing general photos are inserted at the top; missing defect photos at the end.
 */
export function mergeExportPhotoOrder(
  saved: string[] | undefined,
  photos: ExportPhotoListItem[],
): string[] {
  const generalKeys = photos
    .filter((p) => p.group === "general")
    .map((p) => p.key);
  const defectKeys = photos
    .filter((p) => p.group === "defect")
    .map((p) => p.key);
  const keySet = new Set(photos.map((p) => p.key));

  if (!saved?.length) {
    return [...generalKeys, ...defectKeys];
  }

  const savedFiltered = saved.filter((k) => keySet.has(k));
  const used = new Set(savedFiltered);
  const missingGeneral = generalKeys.filter((k) => !used.has(k));
  const missingDefect = defectKeys.filter((k) => !used.has(k));
  return [...missingGeneral, ...savedFiltered, ...missingDefect];
}
