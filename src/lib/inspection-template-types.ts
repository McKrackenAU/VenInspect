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
  | "component_notes";

export type TemplateField = {
  id: string;
  label: string;
  type: FieldType;
  options?: string[];
  hint?: string;
  required?: boolean;
};

export type TemplateSection = {
  id: string;
  title: string;
  /** When true, section starts collapsed until inspector presses + */
  collapsedByDefault?: boolean;
  /** Only show for these asset type codes; omit = all types */
  assetTypes?: string[];
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

/** Persisted on Inspection.formPayload */
export type FormPayload = {
  values: Record<string, string>;
  openSections: string[];
  enabledOptionalPages: string[];
};

export const EMPTY_FORM_PAYLOAD: FormPayload = {
  values: {},
  openSections: [],
  enabledOptionalPages: [],
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

export function parseFormPayload(raw: string | null | undefined): FormPayload {
  if (!raw?.trim()) return { ...EMPTY_FORM_PAYLOAD, values: {}, openSections: [], enabledOptionalPages: [] };
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
    };
  } catch {
    return { ...EMPTY_FORM_PAYLOAD, values: {}, openSections: [], enabledOptionalPages: [] };
  }
}

export function serializeFormPayload(payload: FormPayload): string {
  return JSON.stringify({
    values: payload.values ?? {},
    openSections: payload.openSections ?? [],
    enabledOptionalPages: payload.enabledOptionalPages ?? [],
  });
}

export function fieldFilled(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function sectionFilledCount(
  section: TemplateSection,
  values: Record<string, string>,
): number {
  return section.fields.filter((f) => fieldFilled(values[f.id])).length;
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
