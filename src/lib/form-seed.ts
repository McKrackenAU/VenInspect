import { format } from "date-fns";
import type { Asset } from "@/generated/prisma/client";
import {
  parseAssetComponents,
  parseAssetProfile,
  type AssetComponent,
} from "@/lib/asset-profile";
import {
  EMPTY_FORM_PAYLOAD,
  type FormPayload,
  type InspectionTemplate,
} from "@/lib/inspection-template-types";
import { getDefaultAssetProfileFieldMap } from "@/lib/asset-audit-import";

function shouldAuto(flags: Record<string, boolean> | undefined, key: string) {
  // Explicit false = skip; missing flag = do not auto (admin must opt in)
  return Boolean(flags?.[key]);
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

  // Registry columns when flagged
  if (shouldAuto(flags, "__assetNumber") || shouldAuto(flags, "inv_structure_id")) {
    setIfEmpty("inv_structure_id", opts.asset.assetNumber);
  }
  if (shouldAuto(flags, "__roadName") || shouldAuto(flags, "inv_road_name")) {
    setIfEmpty("inv_road_name", opts.asset.roadName);
  }
  if (shouldAuto(flags, "__location") || shouldAuto(flags, "inv_crossing")) {
    setIfEmpty("inv_crossing", opts.asset.location ?? opts.asset.name);
  }
  if (shouldAuto(flags, "__latitude") || shouldAuto(flags, "inv_lat")) {
    setIfEmpty(
      "inv_lat",
      opts.asset.latitude != null ? String(opts.asset.latitude) : null,
    );
  }
  if (shouldAuto(flags, "__longitude") || shouldAuto(flags, "inv_lng")) {
    setIfEmpty(
      "inv_lng",
      opts.asset.longitude != null ? String(opts.asset.longitude) : null,
    );
  }

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
  values.si_date = format(opts.inspectedAt, "yyyy-MM-dd");

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

  const enabledOptionalPages = opts.template.pages.map((p) => p.id);

  return {
    ...EMPTY_FORM_PAYLOAD,
    values,
    enabledOptionalPages,
    openSections: [],
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
