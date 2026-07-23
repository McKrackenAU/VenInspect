import { randomBytes } from "node:crypto";

export type AssetComponent = {
  id: string;
  name: string;
  category?: string;
  qty?: string;
  unit?: string;
  sortOrder: number;
};

export type AssetProfile = {
  values: Record<string, string>;
  /** Field ids flagged to auto-populate new inspections / reports (admin) */
  autoPopulate?: Record<string, boolean>;
  importedAt?: string;
  sourceFile?: string;
};

export function parseAssetProfile(raw: string | null | undefined): AssetProfile {
  if (!raw?.trim()) return { values: {}, autoPopulate: {} };
  try {
    const parsed = JSON.parse(raw) as AssetProfile;
    const autoPopulate: Record<string, boolean> = {};
    if (parsed.autoPopulate && typeof parsed.autoPopulate === "object") {
      for (const [k, v] of Object.entries(parsed.autoPopulate)) {
        autoPopulate[k] = Boolean(v);
      }
    }
    return {
      values:
        parsed.values && typeof parsed.values === "object" ? parsed.values : {},
      autoPopulate,
      importedAt: parsed.importedAt,
      sourceFile: parsed.sourceFile,
    };
  } catch {
    return { values: {}, autoPopulate: {} };
  }
}

export function serializeAssetProfile(profile: AssetProfile): string {
  return JSON.stringify({
    values: profile.values ?? {},
    autoPopulate: profile.autoPopulate ?? {},
    importedAt: profile.importedAt,
    sourceFile: profile.sourceFile,
  });
}

/** Human labels for common profile / seed field ids (admin Attributes UI). */
export const PROFILE_FIELD_LABELS: Record<string, string> = {
  inv_structure_id: "Structure ID no.",
  inv_chainage: "Chainage (m)",
  inv_road_name: "Road name",
  inv_road_number: "Road number",
  inv_crossing: "Crossing / general location",
  inv_region: "Region",
  inv_lat: "Latitude",
  inv_lng: "Longitude",
  inv_length: "Length (m)",
  inv_overall_width: "O/all width (m)",
  inv_spans: "No. spans",
  inv_beams: "No. beams/slabs",
  inv_width_kerbs: "Width between kerbs (m)",
  inv_span_lengths: "Span lengths (m)",
  inv_cell_length: "Cell length/dia (m)",
  inv_cell_width: "Cell width along invert (m)",
  inv_cell_height: "Cell height (m)",
  inv_cells: "No. of cells",
  inv_cell_sizes: "Cell sizes (m)",
  inv_asbestos: "Asbestos present / likely?",
  inv_load_limit: "Existing posted load limit",
  inv_clearance_height: "Existing posted clearance height",
  inv_speed_limit: "Existing posted speed limit",
  inv_min_vert_clearance: "Min vertical clearance (m)",
  inv_access_notes: "Inspection access / tools / hazards",
  __assetNumber: "Asset code (registry)",
  __roadName: "Road name (registry)",
  __name: "Asset name (registry)",
  __location: "Location (registry)",
  __latitude: "Latitude (registry)",
  __longitude: "Longitude (registry)",
  __notes: "Notes (registry)",
};

export function profileFieldLabel(id: string): string {
  if (PROFILE_FIELD_LABELS[id]) return PROFILE_FIELD_LABELS[id];
  if (id.startsWith("raw:")) return id.slice(4);
  return id.replace(/^attr_/, "").replace(/_/g, " ");
}


export function parseAssetComponents(
  raw: string | null | undefined,
): AssetComponent[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .flatMap((c, i): AssetComponent[] => {
        const row = c as Partial<AssetComponent>;
        const name = String(row.name ?? "").trim();
        if (!name) return [];
        return [
          {
            id: String(row.id ?? `comp_${i}`).trim() || `comp_${i}`,
            name,
            category: row.category ? String(row.category) : undefined,
            qty: row.qty != null ? String(row.qty) : undefined,
            unit: row.unit ? String(row.unit) : undefined,
            sortOrder: Number.isFinite(Number(row.sortOrder))
              ? Number(row.sortOrder)
              : i,
          },
        ];
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  } catch {
    return [];
  }
}

export function serializeAssetComponents(components: AssetComponent[]): string {
  return JSON.stringify(
    components.map((c, i) => ({
      ...c,
      sortOrder: c.sortOrder ?? i,
    })),
  );
}

export function newComponentId() {
  return `comp_${randomBytes(6).toString("hex")}`;
}

/** Default starter components by asset type code. */
export function defaultComponentsForAssetType(type: string): AssetComponent[] {
  const t = type.toUpperCase();
  const starters =
    t === "DRAINAGE"
      ? [
          ["Drainage", "Inlet"],
          ["Drainage", "Outlet"],
          ["Drainage", "Barrel"],
        ]
      : t === "NOISE_WALL"
        ? [
            ["Panels", "Face"],
            ["Structure", "Posts"],
            ["Surrounds", "Access"],
          ]
        : [
            ["Approaches", "Approach A"],
            ["Approaches", "Approach B"],
            ["Superstructure", "Deck"],
            ["Substructure", "Abutment A"],
            ["Substructure", "Abutment B"],
            ["Substructure", "Piers"],
            ["Substructure", "Bearings"],
            ["Waterway", "Channel"],
          ];
  return starters.map(([category, name], i) => ({
    id: newComponentId(),
    name,
    category,
    sortOrder: i,
  }));
}
