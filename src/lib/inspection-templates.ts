import { readStorageSettings, writeStorageSettings } from "@/lib/paths";
import {
  outcomeField,
  textField,
  DEFAULT_OUTCOME_OPTIONS,
  type InspectionTemplate,
  type TemplateField,
  type TemplatePage,
  type TemplateSection,
} from "@/lib/inspection-template-types";

export type {
  FieldType,
  FormPayload,
  InspectionTemplate,
  TemplateBuiltin,
  TemplateField,
  TemplatePage,
  TemplateSection,
} from "@/lib/inspection-template-types";

export {
  DEFAULT_OUTCOME_OPTIONS,
  EMPTY_FORM_PAYLOAD,
  fieldFilled,
  parseFormPayload,
  sectionFilledCount,
  serializeFormPayload,
} from "@/lib/inspection-template-types";

function checklistSection(
  id: string,
  title: string,
  items: string[],
): TemplateSection {
  return {
    id,
    title,
    collapsedByDefault: true,
    fields: items.map((label) => outcomeField(id, label)),
  };
}

/** Seeded from Asset Vision Level 1 Inspection Detail sample (WRU). */
export function seedLevel1Template(): InspectionTemplate {
  const checklistSections: TemplateSection[] = [
    checklistSection("rm711_cleaning", "RM711 Cleaning and Clearing", [
      "Clean deck and footway",
      "Clean expansion Joints",
      "Clean scuppers and down-pipes",
      "Blocked side entry pits on bridges, culverts and approaches",
      "Clean superstructure or substructure of dirt build up",
      "Vegetation growth in structural joints, mortar joints, cracks and other locations on and around structures",
      "Accumulation of dirt, bird and animal droppings and other debris on components preventing drainage, ponding, rusting of steel, seizure of bearings and other moving parts",
    ]),
    checklistSection("rm711_surface", "RM711 Running or wearing surface repairs", [
      "Repair asphaltic/granular surface",
      "Replace running planks",
      "Repair wearing surface",
      "Settlement of Approaches",
    ]),
    checklistSection("rm711_repairs", "RM711 Repairs or painting", [
      "Repair spalled posts/parapets/wingwalls",
      "Railing - Repair or tightening",
      "Railing – Painting",
      "Footway repairs required",
      "Damaged waterproofing seals",
    ]),
    checklistSection("rm711_elements", "RM711 Checking bridge elements", [
      "Bearing & bearing pedestals for damage and movement under beam",
      "Check deck, girders, piers, abutments, beams & wingwalls for looseness & major damage such as cracking, splitting, distortion & excessive movement, especially of origin",
    ]),
    checklistSection("rm712_abutment", "RM712 Abutment & retaining wall weepholes", [
      "Clean weepholes",
      "Scour or settlement of bridge abutment batters",
    ]),
    checklistSection("rm415_waterway", "RM415 Waterway / Watercourse / Stream Maintenance", [
      "Drainage approaches",
      "Drainage Embankments",
      "Remove debris in or around bridge",
      "Scour repairs",
    ]),
    checklistSection("rm611_signs", "RM611 Signs and Bridge Furniture", [
      "Replace bridge signs - Road Signs not legible",
      "Replace bridge markings - Road markings not legible",
      "Additional signs required",
      "Install/replace bridge ID plate",
      "Missing, damaged or corroded components, supports, connections",
    ]),
    checklistSection("rm814_crash", "RM814 Repair Crash Damage", [
      "Repair of crash damage",
      "Repair of guard fence",
      "Repair of wire rope safety barrier",
      "Repair of Impact absorption / barrier terminals",
    ]),
    checklistSection("rm818_vandalism", "RM818 Vandalism Repair or Graffiti Work", [
      "Repairs needed due to vandalism",
      "Removal of Graffiti that is offensive and Hazardous to Road Users",
    ]),
  ];

  const pages: TemplatePage[] = [
    {
      id: "checklist",
      title: "Checklist",
      sections: checklistSections,
    },
    {
      id: "conclusion",
      title: "Conclusion",
      sections: [
        {
          id: "fmrp",
          title: "FMRP / follow-up",
          collapsedByDefault: false,
          fields: [
            textField(
              "concl_needs_l2",
              "Does the structure require level 2 inspections?",
              "yesno",
            ),
            textField(
              "concl_fmrp_annual",
              "Any FMRP activities to be raised for annual program?",
              "yesno",
            ),
            textField("concl_comments", "Comments", "textarea"),
          ],
        },
      ],
    },
    {
      id: "defects",
      title: "Defects",
      builtin: "defects",
      sections: [],
    },
  ];

  return {
    typeCode: "LEVEL_1",
    label: "Level 1",
    pages,
  };
}

function l2Text(id: string, label: string, type: TemplateField["type"] = "text") {
  return textField(id, label, type);
}

/** Seeded from WRU Level 2 inspection report template v1.4 sheet structure. */
export function seedLevel2Template(): InspectionTemplate {
  const pages: TemplatePage[] = [
    {
      id: "structure_info",
      title: "Structure info",
      sections: [
        {
          id: "si_header",
          title: "Header",
          collapsedByDefault: false,
          fields: [
            l2Text("si_inspector", "Inspector"),
            l2Text("si_date", "Date", "date"),
            l2Text("si_weather", "Weather"),
            l2Text("si_temperature", "Temperature (°C)", "number"),
            l2Text("si_fully_inspected", "Fully inspected?", "yesno"),
          ],
        },
        {
          id: "si_condition_rating",
          title: "Overall condition rating",
          collapsedByDefault: true,
          fields: [
            {
              id: "si_cr_choice",
              label: "Condition rating (1–5)",
              type: "select",
              options: [
                "1 — all components = CS1",
                "2 — all components ≤ CS2",
                "3 — all components ≤ CS3 (misc/cladding ≤ CS4)",
                "4 — 1–2 components partly/fully CS4",
                "5 — 3+ components CS4 / major residual life / restrictions",
              ],
            },
            l2Text("si_general_notes", "General notes", "textarea"),
          ],
        },
        {
          id: "si_summaries",
          title: "Defect / task summaries",
          collapsedByDefault: true,
          fields: [
            l2Text("si_defect_summary", "Defect summary", "textarea"),
            l2Text("si_rm_tasks", "RM tasks", "textarea"),
            l2Text("si_investigate", "Investigate", "textarea"),
            l2Text("si_monitor", "Monitor", "textarea"),
            l2Text("si_fmrp_tasks", "FMRP tasks", "textarea"),
          ],
        },
      ],
    },
    {
      id: "inventory",
      title: "Inventory",
      optional: true,
      sections: [
        {
          id: "inv_ids",
          title: "Identification",
          collapsedByDefault: true,
          fields: [
            l2Text("inv_structure_id", "Structure ID no."),
            l2Text("inv_chainage", "Chainage (m)"),
            l2Text("inv_road_name", "Road name"),
            l2Text("inv_road_number", "Road number"),
            l2Text("inv_crossing", "Crossing / general location", "textarea"),
            l2Text("inv_region", "Region"),
            l2Text("inv_lat", "Latitude", "number"),
            l2Text("inv_lng", "Longitude", "number"),
          ],
        },
        {
          id: "inv_bridge",
          title: "Bridge measurements",
          collapsedByDefault: true,
          fields: [
            l2Text("inv_length", "Length (m)", "number"),
            l2Text("inv_overall_width", "O/all width (m)", "number"),
            l2Text("inv_spans", "No. spans", "number"),
            l2Text("inv_beams", "No. beams/slabs", "number"),
            l2Text("inv_width_kerbs", "Width between kerbs (m)", "number"),
            l2Text("inv_span_lengths", "Span lengths (m)", "textarea"),
          ],
        },
        {
          id: "inv_culvert",
          title: "Culvert measurements",
          collapsedByDefault: true,
          fields: [
            l2Text("inv_cell_length", "Cell length/dia (m)", "number"),
            l2Text("inv_cell_width", "Cell width along invert (m)", "number"),
            l2Text("inv_cell_height", "Cell height (m)", "number"),
            l2Text("inv_cells", "No. of cells", "number"),
            l2Text("inv_cell_sizes", "Cell sizes (m)", "textarea"),
          ],
        },
        {
          id: "inv_limits",
          title: "Limitations & access",
          collapsedByDefault: true,
          fields: [
            l2Text("inv_asbestos", "Asbestos present / likely?", "textarea"),
            l2Text("inv_load_limit", "Existing posted load limit"),
            l2Text("inv_clearance_height", "Existing posted clearance height"),
            l2Text("inv_speed_limit", "Existing posted speed limit"),
            l2Text("inv_min_vert_clearance", "Min vertical clearance overpass (m)", "number"),
            l2Text("inv_access_notes", "Inspection access / tools / hazards", "textarea"),
          ],
        },
      ],
    },
    {
      id: "vertical_clearance",
      title: "Vertical clearance",
      optional: true,
      sections: [
        {
          id: "vc_bridge",
          title: "Bridge / major culvert measurements",
          collapsedByDefault: true,
          fields: [
            l2Text("vc_location_notes", "Measurement locations / sketch notes", "textarea"),
            l2Text("vc_m1", "Measurement 1 (m)", "number"),
            l2Text("vc_m2", "Measurement 2 (m)", "number"),
            l2Text("vc_m3", "Measurement 3 (m)", "number"),
            l2Text("vc_m4", "Measurement 4 (m)", "number"),
            l2Text("vc_m5", "Measurement 5 (m)", "number"),
            l2Text("vc_sag", "Sag allowance", "number"),
            l2Text("vc_rounded", "Rounded clearance", "number"),
            l2Text("vc_dataset", "DTP Structure Height Clearance dataset notes", "textarea"),
            l2Text("vc_signs", "Vertical clearance signs", "textarea"),
          ],
        },
      ],
    },
    {
      id: "condition_rating",
      title: "Condition rating",
      optional: true,
      sections: [
        {
          id: "cr_rows",
          title: "Components",
          collapsedByDefault: true,
          fields: [
            l2Text("cr_comp_1", "Component 1 (name / qty / CS1–4 / notes)", "textarea"),
            l2Text("cr_comp_2", "Component 2 (name / qty / CS1–4 / notes)", "textarea"),
            l2Text("cr_comp_3", "Component 3 (name / qty / CS1–4 / notes)", "textarea"),
            l2Text("cr_comp_4", "Component 4 (name / qty / CS1–4 / notes)", "textarea"),
            l2Text("cr_comp_5", "Component 5 (name / qty / CS1–4 / notes)", "textarea"),
            l2Text("cr_comp_more", "Additional components", "textarea"),
            l2Text("cr_notes", "Condition rating notes", "textarea"),
          ],
        },
      ],
    },
    {
      id: "components",
      title: "Component notes",
      sections: [
        {
          id: "comp_approaches",
          title: "Approaches",
          collapsedByDefault: true,
          fields: [
            l2Text("comp_approach_a", "Approach A", "textarea"),
            l2Text("comp_approach_b", "Approach B", "textarea"),
            l2Text("comp_barriers", "Barriers", "textarea"),
          ],
        },
        {
          id: "comp_super",
          title: "Superstructure",
          collapsedByDefault: true,
          fields: [
            l2Text("comp_deck", "Deck", "textarea"),
            l2Text("comp_beams", "Beams / girders", "textarea"),
            l2Text("comp_joints", "Expansion joints", "textarea"),
          ],
        },
        {
          id: "comp_sub",
          title: "Substructure",
          collapsedByDefault: true,
          fields: [
            l2Text("comp_abut_a", "Abutment A", "textarea"),
            l2Text("comp_abut_b", "Abutment B", "textarea"),
            l2Text("comp_piers", "Piers", "textarea"),
            l2Text("comp_bearings", "Bearings", "textarea"),
          ],
        },
        {
          id: "comp_waterway",
          title: "Waterway / drainage",
          collapsedByDefault: true,
          fields: [
            l2Text("comp_channel", "Channel", "textarea"),
            l2Text("comp_scour", "Scour", "textarea"),
            l2Text("comp_embankments", "Embankments", "textarea"),
            l2Text("comp_inlet", "Inlet", "textarea"),
            l2Text("comp_outlet", "Outlet", "textarea"),
            l2Text("comp_barrel", "Barrel", "textarea"),
          ],
        },
      ],
    },
    {
      id: "defects",
      title: "Defects",
      builtin: "defects",
      sections: [],
    },
    {
      id: "photos",
      title: "Photos",
      builtin: "photos",
      optional: true,
      sections: [
        {
          id: "photo_register",
          title: "Photo register notes",
          collapsedByDefault: true,
          fields: [
            l2Text("photo_register_notes", "Register / references", "textarea"),
          ],
        },
      ],
    },
  ];

  return {
    typeCode: "LEVEL_2",
    label: "Level 2",
    pages,
  };
}

export function defaultTemplates(): Record<string, InspectionTemplate> {
  const l1 = seedLevel1Template();
  const l2 = seedLevel2Template();
  return {
    [l1.typeCode]: l1,
    [l2.typeCode]: l2,
  };
}

function normalizeTemplate(raw: unknown, fallbackCode: string): InspectionTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Partial<InspectionTemplate>;
  if (!Array.isArray(t.pages)) return null;
  const typeCode = String(t.typeCode ?? fallbackCode)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (!typeCode) return null;
  return {
    typeCode,
    label: String(t.label ?? typeCode).trim() || typeCode,
    pages: t.pages.map((p, pi) => ({
      id: String(p.id ?? `page_${pi}`),
      title: String(p.title ?? `Page ${pi + 1}`),
      optional: Boolean(p.optional),
      builtin: p.builtin === "defects" || p.builtin === "photos" ? p.builtin : null,
      sections: Array.isArray(p.sections)
        ? p.sections.map((s, si) => ({
            id: String(s.id ?? `sec_${pi}_${si}`),
            title: String(s.title ?? `Section ${si + 1}`),
            collapsedByDefault: s.collapsedByDefault !== false,
            fields: Array.isArray(s.fields)
              ? s.fields.map((f, fi) => ({
                  id: String(f.id ?? `f_${pi}_${si}_${fi}`),
                  label: String(f.label ?? `Field ${fi + 1}`),
                  type: (f.type as TemplateField["type"]) || "text",
                  options: Array.isArray(f.options)
                    ? f.options.map(String)
                    : (f.type as string) === "outcome"
                      ? [...DEFAULT_OUTCOME_OPTIONS]
                      : undefined,
                  hint: f.hint ? String(f.hint) : undefined,
                }))
              : [],
          }))
        : [],
    })),
  };
}

/** All templates (settings overlay defaults). */
export function getInspectionTemplates(): Record<string, InspectionTemplate> {
  const defaults = defaultTemplates();
  const fromSettings = readStorageSettings().inspectionTemplates;
  if (!fromSettings || typeof fromSettings !== "object") return defaults;

  const merged: Record<string, InspectionTemplate> = { ...defaults };
  for (const [key, val] of Object.entries(fromSettings)) {
    const code = key.toUpperCase().replace(/\s+/g, "_");
    const normalized = normalizeTemplate(val, code);
    if (normalized) merged[normalized.typeCode] = normalized;
  }
  return merged;
}

export function getTemplateForLevel(level: string): InspectionTemplate {
  const code = level.trim().toUpperCase().replace(/\s+/g, "_");
  const all = getInspectionTemplates();
  if (all[code]) return all[code];
  // Fallback: Level 1-like for unknown types
  if (code.includes("2")) return all.LEVEL_2 ?? seedLevel2Template();
  return all.LEVEL_1 ?? seedLevel1Template();
}

export function saveInspectionTemplates(
  templates: Record<string, InspectionTemplate>,
) {
  const cleaned: Record<string, InspectionTemplate> = {};
  for (const [key, val] of Object.entries(templates)) {
    const n = normalizeTemplate(val, key);
    if (n) cleaned[n.typeCode] = n;
  }
  if (Object.keys(cleaned).length === 0) {
    throw new Error("At least one inspection template is required");
  }
  writeStorageSettings({
    inspectionTemplates: cleaned as Record<string, unknown>,
  });
  return cleaned;
}

export function resetTemplateToSeed(typeCode: string): InspectionTemplate {
  const code = typeCode.trim().toUpperCase().replace(/\s+/g, "_");
  const seed =
    code === "LEVEL_2" || code.includes("2")
      ? seedLevel2Template()
      : seedLevel1Template();
  const all = getInspectionTemplates();
  all[seed.typeCode] = seed;
  saveInspectionTemplates(all);
  return seed;
}
