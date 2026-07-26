/** Client-safe inspection form template types (no node:fs). */

export type FieldType =
  | "outcome"
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "yesno"
  | "date"
  | "checkbox"
  | "component_table"
  | "component_notes"
  | "measurement_list";

export type TemplateField = {
  id: string;
  label: string;
  type: FieldType;
  options?: string[];
  hint?: string;
  required?: boolean;
  /** Allow capturing photos against this field */
  allowPhotos?: boolean;
  /** Allow raising a defect from this field */
  allowRaiseDefect?: boolean;
  /** Include field photos in generated reports (default true when allowPhotos) */
  includePhotosInReport?: boolean;
};

export type TemplateSection = {
  id: string;
  title: string;
  /** When true, section starts collapsed until inspector presses + */
  collapsedByDefault?: boolean;
  /** Only show for these asset type codes; omit = all types */
  assetTypes?: string[];
  /** Allow capturing overview photos for this section */
  allowPhotos?: boolean;
  /** Allow raising a defect from section media */
  allowRaiseDefect?: boolean;
  /** Include section photos in generated reports */
  includePhotosInReport?: boolean;
  fields: TemplateField[];
};

export type TemplateBuiltin = "defects" | "photos" | null;

export type TemplatePage = {
  id: string;
  title: string;
  optional?: boolean;
  builtin?: TemplateBuiltin;
  sections: TemplateSection[];
};

export type InspectionTemplate = {
  typeCode: string;
  label: string;
  pages: TemplatePage[];
};

/** Photo attached to a form section or field */
export type FormMediaItem = {
  id: string;
  path: string;
  caption?: string;
  /** Field id when attached to a specific field; omit for section-level */
  fieldId?: string;
  /** Linked defect created from this media */
  defectId?: string;
  /** Capture date ISO (EXIF / file date) for watermark + DoT register */
  takenAt?: string;
};

/** Persisted on Inspection.formPayload */
export type FormPayload = {
  values: Record<string, string>;
  openSections: string[];
  enabledOptionalPages: string[];
  /** Keyed by section id (section photos) or `${sectionId}::${fieldId}` */
  media?: Record<string, FormMediaItem[]>;
  /** Stable photo keys for Client Export ZIP / index order */
  exportPhotoOrder?: string[];
};

export type MeasurementListRow = {
  id: string;
  label?: string;
  value: string;
};

export type ComponentNotesRow = {
  id: string;
  label: string;
  notes: string;
  /** When seeded from asset component register */
  componentId?: string;
};

export const EMPTY_FORM_PAYLOAD: FormPayload = {
  values: {},
  openSections: [],
  enabledOptionalPages: [],
  media: {},
};

export const DEFAULT_OUTCOME_OPTIONS = [
  "Inspected - No defects identified",
  "Inspected - Defects identified and RM job created",
  "Inspected - Defects identified and FMRP job created",
  "Inspected - Defects identified are minor deterioration only to be assessed during next Level 2 inspection",
  "Unable to inspect - No feature present",
  "Unable to inspect - Unable to access",
  "N/A",
];

export const ID_PLATE_CONDITION_OPTIONS = [
  "OK",
  "Damaged",
  "Missing",
  "Not sighted",
] as const;

function parseMedia(
  raw: unknown,
): Record<string, FormMediaItem[]> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, FormMediaItem[]> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(val)) continue;
    out[key] = val
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => ({
        id: String(item.id ?? ""),
        path: String(item.path ?? ""),
        caption: item.caption != null ? String(item.caption) : undefined,
        fieldId: item.fieldId != null ? String(item.fieldId) : undefined,
        defectId: item.defectId != null ? String(item.defectId) : undefined,
        takenAt: item.takenAt != null ? String(item.takenAt) : undefined,
      }))
      .filter((item) => item.id && item.path);
  }
  return out;
}

export function parseFormPayload(raw: string | null | undefined): FormPayload {
  if (!raw?.trim()) {
    return {
      ...EMPTY_FORM_PAYLOAD,
      values: {},
      openSections: [],
      enabledOptionalPages: [],
      media: {},
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<FormPayload>;
    return {
      values:
        parsed.values && typeof parsed.values === "object"
          ? Object.fromEntries(
              Object.entries(parsed.values).map(([k, v]) => [
                k,
                v == null ? "" : String(v),
              ]),
            )
          : {},
      openSections: Array.isArray(parsed.openSections)
        ? parsed.openSections.map(String)
        : [],
      enabledOptionalPages: Array.isArray(parsed.enabledOptionalPages)
        ? parsed.enabledOptionalPages.map(String)
        : [],
      media: parseMedia(parsed.media),
      exportPhotoOrder: Array.isArray(parsed.exportPhotoOrder)
        ? parsed.exportPhotoOrder.map(String)
        : undefined,
    };
  } catch {
    return {
      ...EMPTY_FORM_PAYLOAD,
      values: {},
      openSections: [],
      enabledOptionalPages: [],
      media: {},
    };
  }
}

export function serializeFormPayload(payload: FormPayload): string {
  return JSON.stringify({
    values: payload.values ?? {},
    openSections: payload.openSections ?? [],
    enabledOptionalPages: payload.enabledOptionalPages ?? [],
    media: payload.media ?? {},
    ...(payload.exportPhotoOrder?.length
      ? { exportPhotoOrder: payload.exportPhotoOrder }
      : {}),
  });
}

export function mediaKey(sectionId: string, fieldId?: string | null) {
  if (fieldId) return `${sectionId}::${fieldId}`;
  return sectionId;
}

export function fieldFilled(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function sectionFilledCount(
  section: TemplateSection,
  values: Record<string, string>,
): number {
  return section.fields.filter((f) => {
    if (f.type === "measurement_list" || f.type === "component_notes" || f.type === "component_table") {
      try {
        const rows = JSON.parse(values[f.id] || "[]") as unknown[];
        if (!Array.isArray(rows) || rows.length === 0) return false;
        if (f.type === "component_table") {
          return rows.some(
            (r) =>
              r &&
              typeof r === "object" &&
              (("notes" in r && String((r as { notes?: string }).notes ?? "").trim()) ||
                ("cs1" in r && String((r as { cs1?: string }).cs1 ?? "").trim()) ||
                ("cs2" in r && String((r as { cs2?: string }).cs2 ?? "").trim()) ||
                ("cs3" in r && String((r as { cs3?: string }).cs3 ?? "").trim()) ||
                ("cs4" in r && String((r as { cs4?: string }).cs4 ?? "").trim())),
          );
        }
        if (f.type === "measurement_list") {
          return rows.some(
            (r) =>
              r &&
              typeof r === "object" &&
              String((r as { value?: string }).value ?? "").trim(),
          );
        }
        return rows.some(
          (r) =>
            r &&
            typeof r === "object" &&
            String((r as { notes?: string }).notes ?? "").trim(),
        );
      } catch {
        return fieldFilled(values[f.id]);
      }
    }
    return fieldFilled(values[f.id]);
  }).length;
}

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

export function outcomeField(
  groupId: string,
  label: string,
  options = DEFAULT_OUTCOME_OPTIONS,
): TemplateField {
  return {
    id: `${groupId}__${slug(label)}`,
    label,
    type: "outcome",
    options: [...options],
  };
}

export function textField(
  id: string,
  label: string,
  type: FieldType = "text",
  hint?: string,
): TemplateField {
  return { id, label, type, hint };
}

export function defaultMeasurementRows(count = 5): MeasurementListRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `m${i + 1}`,
    label: `Measurement ${i + 1}`,
    value: "",
  }));
}

export function parseMeasurementList(raw: string | undefined): MeasurementListRow[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .map((r, i) => ({
        id: String(r.id ?? `m${i + 1}`),
        label: r.label != null ? String(r.label) : undefined,
        value: String(r.value ?? ""),
      }));
  } catch {
    return [];
  }
}

export function parseComponentNotes(raw: string | undefined): ComponentNotesRow[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .map((r, i) => ({
        id: String(r.id ?? `part_${i + 1}`),
        label: String(r.label ?? `Part ${i + 1}`),
        notes: String(r.notes ?? ""),
        componentId: r.componentId != null ? String(r.componentId) : undefined,
      }));
  } catch {
    return [];
  }
}

/** Human-readable form field value for HTML report preview (not raw JSON). */
export function formatFormFieldDisplayValue(
  field: TemplateField,
  raw: string | undefined,
): string {
  const value = raw?.trim() ?? "";
  if (!value) return "—";
  if (field.type === "component_table") {
    try {
      const rows = JSON.parse(value) as {
        name?: string;
        qty?: string;
        unit?: string;
        notes?: string;
        cs1?: string;
        cs2?: string;
        cs3?: string;
        cs4?: string;
        pct1?: string;
        pct2?: string;
        pct3?: string;
        pct4?: string;
      }[];
      if (!Array.isArray(rows) || rows.length === 0) return "—";
      return rows
        .map((r) => {
          const cs = [r.cs1, r.cs2, r.cs3, r.cs4].map((x) => x ?? "0").join("/");
          const pct = [r.pct1, r.pct2, r.pct3, r.pct4]
            .filter((x) => x != null && String(x).trim())
            .join("/");
          return `${r.name ?? "?"} qty=${r.qty ?? ""}${r.unit ? ` ${r.unit}` : ""} CS=${cs}${pct ? ` (${pct}%)` : ""}${r.notes ? ` — ${r.notes}` : ""}`;
        })
        .join("\n");
    } catch {
      return value;
    }
  }
  if (field.type === "measurement_list") {
    const rows = parseMeasurementList(value);
    const filled = rows.filter((r) => r.value.trim());
    if (!filled.length) return "—";
    return filled.map((r) => `${r.label || r.id}: ${r.value} m`).join("; ");
  }
  if (field.type === "component_notes") {
    const rows = parseComponentNotes(value);
    if (!rows.length) return "—";
    return rows.map((r) => `${r.label}: ${r.notes.trim() || "—"}`).join("\n");
  }
  return value;
}

/** Migrate legacy vc_m1..vc_m5 into vc_measurements JSON if needed. */
export function migrateLegacyClearanceMeasurements(
  values: Record<string, string>,
): Record<string, string> {
  if (values.vc_measurements?.trim()) return values;
  const legacy = [1, 2, 3, 4, 5].map((n) => ({
    id: `m${n}`,
    label: `Measurement ${n}`,
    value: values[`vc_m${n}`] ?? "",
  }));
  if (!legacy.some((r) => r.value.trim())) return values;
  return {
    ...values,
    vc_measurements: JSON.stringify(legacy),
  };
}
