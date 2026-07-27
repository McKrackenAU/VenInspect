import type { Asset } from "@/generated/prisma/client";
import { formatAppDate } from "@/lib/date-time";
import {
  parseAssetComponents,
  parseAssetProfile,
  type AssetComponent,
} from "@/lib/asset-profile";
import {
  EMPTY_FORM_PAYLOAD,
  defaultMeasurementRows,
  migrateLegacyClearanceMeasurements,
  parseFormPayload,
  parseMeasurementList,
  type ComponentNotesRow,
  type FormPayload,
  type InspectionTemplate,
} from "@/lib/inspection-template-types";
import { getDefaultAssetProfileFieldMap } from "@/lib/asset-audit-import";

function shouldAuto(flags: Record<string, boolean> | undefined, key: string) {
  // Explicit false = skip; missing flag = do not auto (admin must opt in)
  return Boolean(flags?.[key]);
}

const COMPONENT_NOTES_DEFAULTS: Record<string, { labels: string[]; categories: string[] }> = {
  comp_notes_approaches: {
    labels: ["Approach A", "Approach B", "Barriers"],
    categories: ["approaches", "approach"],
  },
  comp_notes_super: {
    labels: ["Deck", "Beams / girders", "Expansion joints"],
    categories: ["superstructure", "super"],
  },
  comp_notes_sub: {
    labels: ["Abutment A", "Abutment B", "Piers", "Bearings"],
    categories: ["substructure", "sub"],
  },
  comp_notes_waterway: {
    labels: ["Channel", "Scour", "Embankments", "Inlet", "Outlet", "Barrel"],
    categories: ["waterway", "drainage", "waterway / drainage"],
  },
};

function categoryMatches(componentCategory: string | undefined, needles: string[]) {
  const c = (componentCategory ?? "").trim().toLowerCase();
  if (!c) return false;
  return needles.some((n) => c === n || c.includes(n));
}

function seedComponentNotes(
  fieldId: string,
  components: AssetComponent[],
): ComponentNotesRow[] {
  const def = COMPONENT_NOTES_DEFAULTS[fieldId];
  if (!def) return [];
  const matched = components.filter((c) =>
    categoryMatches(c.category, def.categories),
  );
  if (matched.length > 0) {
    return matched.map((c) => ({
      id: c.id,
      label: c.name,
      notes: "",
      componentId: c.id,
    }));
  }
  return def.labels.map((label, i) => ({
    id: `${fieldId}_${i + 1}`,
    label,
    notes: "",
  }));
}

function copyClearancesFromPrior(priorRaw: string | null | undefined): Record<string, string> {
  if (!priorRaw?.trim()) return {};
  const prior = migrateLegacyClearanceMeasurements(parseFormPayload(priorRaw).values);
  const out: Record<string, string> = {};
  const measurements = parseMeasurementList(prior.vc_measurements);
  if (measurements.some((m) => m.value.trim())) {
    out.vc_measurements = JSON.stringify(measurements);
  }
  for (const key of ["vc_sag", "vc_rounded", "vc_location_notes", "vc_dataset", "vc_signs"] as const) {
    if (prior[key]?.trim()) out[key] = prior[key];
  }
  // Legacy fixed fields if no list yet
  if (!out.vc_measurements) {
    const legacy = [1, 2, 3, 4, 5].map((n) => ({
      id: `m${n}`,
      label: `Measurement ${n}`,
      value: prior[`vc_m${n}`] ?? "",
    }));
    if (legacy.some((r) => r.value.trim())) {
      out.vc_measurements = JSON.stringify(legacy);
    }
  }
  return out;
}

/** Map asset columns + profile into template field ids for a new draft. */
export function seedFormPayloadFromAsset(opts: {
  asset: Pick<
    Asset,
    | "assetNumber"
    | "name"
    | "roadName"
    | "location"
    | "latitude"
    | "longitude"
    | "type"
    | "profileJson"
    | "componentsJson"
    | "notes"
  >;
  template: InspectionTemplate;
  inspectorName: string;
  inspectedAt: Date;
  /** Most recent prior inspection formPayload for clearance carry-forward */
  priorFormPayload?: string | null;
}): FormPayload {
  const profile = parseAssetProfile(opts.asset.profileJson);
  const flags = profile.autoPopulate ?? {};
  const values: Record<string, string> = {};

  const setIfEmpty = (id: string, v: string | number | null | undefined) => {
    if (v == null || v === "") return;
    const s = String(v);
    if (!values[id]?.trim()) values[id] = s;
  };

  // Profile values — only flagged fields
  for (const [key, val] of Object.entries(profile.values)) {
    if (!val?.trim()) continue;
    if (!shouldAuto(flags, key)) continue;
    values[key] = val;
  }

  // Core identity ALWAYS from registry (Structure ID / road / location / coords)
  setIfEmpty("inv_structure_id", opts.asset.assetNumber);
  setIfEmpty("inv_road_name", opts.asset.roadName);
  setIfEmpty("inv_crossing", opts.asset.location ?? opts.asset.name);
  setIfEmpty(
    "inv_lat",
    opts.asset.latitude != null ? String(opts.asset.latitude) : null,
  );
  setIfEmpty(
    "inv_lng",
    opts.asset.longitude != null ? String(opts.asset.longitude) : null,
  );

  // Alias map: only when source flagged
  const fieldMap = getDefaultAssetProfileFieldMap();
  for (const [displayOrId, fieldId] of Object.entries(fieldMap)) {
    const src =
      profile.values[displayOrId] ||
      profile.values[fieldId] ||
      "";
    if (!src.trim()) continue;
    if (
      !shouldAuto(flags, displayOrId) &&
      !shouldAuto(flags, fieldId) &&
      !shouldAuto(flags, `raw:${displayOrId}`)
    ) {
      continue;
    }
    if (!values[fieldId]?.trim()) values[fieldId] = src;
  }

  // Visit header always from session (not asset profile flags)
  values.si_inspector = opts.inspectorName;
  values.si_date = formatAppDate(opts.inspectedAt, "isoDate");

  // Components register always seeds condition-rating rows
  const components = parseAssetComponents(opts.asset.componentsJson);
  if (components.length > 0) {
    values.cr_components = JSON.stringify(
      components.map((c: AssetComponent) => ({
        id: c.id,
        name: c.name,
        category: c.category ?? "",
        qty: c.qty ?? "",
        unit: c.unit ?? "",
        cs1: "",
        cs2: "",
        cs3: "",
        cs4: "",
        notes: "",
      })),
    );
  }

  // Component notes sections
  for (const fieldId of Object.keys(COMPONENT_NOTES_DEFAULTS)) {
    values[fieldId] = JSON.stringify(seedComponentNotes(fieldId, components));
  }

  // Default clearance measurement slots
  values.vc_measurements = JSON.stringify(defaultMeasurementRows(5));

  // Optional: auto-fill clearances from previous report
  if (shouldAuto(flags, "__seedClearancesFromPrior") && opts.priorFormPayload) {
    const copied = copyClearancesFromPrior(opts.priorFormPayload);
    Object.assign(values, copied);
  }

  const enabledOptionalPages = opts.template.pages.map((p) => p.id);

  return {
    ...EMPTY_FORM_PAYLOAD,
    values,
    enabledOptionalPages,
    openSections: [],
    media: {},
  };
}

/** Whether a template section should show for this asset type. */
export function sectionVisibleForAssetType(
  assetTypes: string[] | undefined,
  assetType: string,
): boolean {
  if (!assetTypes || assetTypes.length === 0) return true;
  return assetTypes.includes(assetType);
}
