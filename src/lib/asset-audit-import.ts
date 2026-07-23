import * as XLSX from "xlsx";
import { readStorageSettings } from "@/lib/paths";

/** Default Display Name → form/profile field id for Asset Vision Audit Export. */
export function getDefaultAssetProfileFieldMap(): Record<string, string> {
  const fromSettings = readStorageSettings().assetProfileFieldMap;
  const defaults: Record<string, string> = {
    "Overall Length (m)": "inv_length",
    "Overall Width (m)": "inv_overall_width",
    "No. Spans": "inv_spans",
    "Clear Width (m)": "inv_width_kerbs",
    "Traffic Width (m)": "inv_width_kerbs",
    "Min Clearance (m)": "inv_min_vert_clearance",
    "Culvert Cell Height (m)": "inv_cell_height",
    "DoT Region": "inv_region",
    Region: "inv_region",
    "Feature Crossed": "inv_crossing",
    "DTP Asset ID": "inv_structure_id",
    "Structure ID": "inv_structure_id",
    Chainage: "inv_chainage",
    "Road Name": "inv_road_name",
    "Road Number": "inv_road_number",
    Latitude: "inv_lat",
    Longitude: "inv_lng",
    "GPS Latitude": "inv_lat",
    "GPS Longitude": "inv_lng",
    "Design Life": "attr_design_life",
    "Date of Last Level 2": "attr_last_l2",
    "Number of Cells": "inv_cells",
    "Cell Length (m)": "inv_cell_length",
    "Cell Width (m)": "inv_cell_width",
  };
  return { ...defaults, ...(fromSettings ?? {}) };
}

export type AuditImportRow = {
  displayName: string;
  newValue: string;
  fieldId: string | null;
  date?: string;
};

/** Collapse Audit Export sheet to latest New Value per Display Name. */
export function parseAssetAuditExport(buffer: Buffer): {
  rows: AuditImportRow[];
  values: Record<string, string>;
} {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  const map = getDefaultAssetProfileFieldMap();
  const byLabel = new Map<
    string,
    { value: string; dateMs: number; date?: string }
  >();

  for (const row of raw) {
    const keys = Object.keys(row);
    const find = (...names: string[]) => {
      const hit = keys.find((k) =>
        names.some((n) => k.trim().toLowerCase() === n.toLowerCase()),
      );
      return hit ? String(row[hit] ?? "").trim() : "";
    };
    const displayName = find("Display Name", "DisplayName", "Attribute");
    const newValue = find("New Value", "NewValue", "Value");
    const dateStr = find("Date");
    if (!displayName) continue;
    let dateMs = 0;
    if (dateStr) {
      const t = Date.parse(dateStr);
      if (!Number.isNaN(t)) dateMs = t;
    }
    const prev = byLabel.get(displayName);
    if (!prev || dateMs >= prev.dateMs) {
      byLabel.set(displayName, {
        value: normalizeAuditValue(newValue),
        dateMs,
        date: dateStr || undefined,
      });
    }
  }

  const rows: AuditImportRow[] = [];
  const values: Record<string, string> = {};
  for (const [displayName, { value, date }] of byLabel) {
    const fieldId =
      map[displayName] ??
      map[displayName.trim()] ??
      slugFieldId(displayName);
    rows.push({ displayName, newValue: value, fieldId, date });
    if (value !== "") {
      values[fieldId] = value;
      // Also store under display name for leftovers
      values[`raw:${displayName}`] = value;
    }
  }
  return { rows, values };
}

function normalizeAuditValue(v: string): string {
  const t = v.trim();
  if (/^(true|yes)$/i.test(t)) return "YES";
  if (/^(false|no)$/i.test(t)) return "NO";
  return t;
}

function slugFieldId(label: string): string {
  return (
    "attr_" +
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 64)
  );
}

/** Sync a few core asset columns from imported profile values. */
export function profileSyncHints(values: Record<string, string>): {
  latitude?: number;
  longitude?: number;
  notes?: string;
  lastLevel2At?: Date;
  assetNumber?: string;
} {
  const out: {
    latitude?: number;
    longitude?: number;
    notes?: string;
    lastLevel2At?: Date;
    assetNumber?: string;
  } = {};
  const lat = values.inv_lat ?? values["attr_gps_latitude"];
  const lng = values.inv_lng ?? values["attr_gps_longitude"];
  if (lat && !Number.isNaN(Number(lat))) out.latitude = Number(lat);
  if (lng && !Number.isNaN(Number(lng))) out.longitude = Number(lng);
  const notes = values["raw:Alert Notes"] ?? values["raw:Notes"];
  if (notes) out.notes = notes;
  const l2 = values.attr_last_l2 ?? values["raw:Date of Last Level 2"];
  if (l2) {
    const d = Date.parse(l2);
    if (!Number.isNaN(d)) out.lastLevel2At = new Date(d);
  }
  const sn = values.inv_structure_id;
  if (sn) out.assetNumber = sn;
  return out;
}
