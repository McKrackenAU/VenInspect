import * as XLSX from "xlsx";
import { inferAssetSubClass } from "@/lib/asset-subclasses";

export type ImportedAssetRow = {
  assetVisionId: string | null;
  assetNumber: string;
  name: string;
  type: string;
  roadName: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  parentDirection: string | null;
  parentChainage: number | null;
  chainageFrom: number | null;
  chainageTo: number | null;
  parentAssetCode: string | null;
  parentAssetName: string | null;
  classification: string | null;
  subClassification: string | null;
  notes: string | null;
};

const HEADER_ALIASES: Record<string, string[]> = {
  assetVisionId: [
    "asset id",
    "assetvisionid",
    "asset vision id",
    "assetvision id",
    "avid",
    "av id",
    "av_id",
    "av-id",
    "asset_vision_id",
  ],
  assetNumber: ["code", "asset number", "assetnumber", "serial", "sn"],
  name: ["name", "asset name", "description"],
  type: ["type", "asset type", "structure type"],
  roadName: ["road", "road name", "roadname"],
  location: ["location", "site", "address"],
  latitude: ["latitude", "lat", "y"],
  longitude: ["longitude", "lng", "lon", "long", "x"],
  parentDirection: ["parent direction", "direction"],
  parentChainage: ["parent chainage", "chainage"],
  chainageFrom: [
    "chainage from",
    "chainagefrom",
    "from chainage",
    "start chainage",
    "chainage start",
  ],
  chainageTo: [
    "chainage to",
    "chainageto",
    "to chainage",
    "end chainage",
    "chainage end",
  ],
  parentAssetCode: [
    "parent asset code",
    "parentassetcode",
    "parent code",
    "road asset code",
    "road code",
    "parent road code",
  ],
  parentAssetName: [
    "parent asset name",
    "parentassetname",
    "parent name",
    "parent road name",
    "road asset name",
  ],
  /** Combined "Anderson Road-5571" or "Anderson Road - 5571" */
  roadAssetCode: [
    "road asset",
    "roadasset",
    "parentasset",
    "parent asset",
    "road asset id",
  ],
  classification: ["classification"],
  subClassification: [
    "sub classification",
    "subclassification",
    "subclass",
    "sub class",
    "asset subclass",
  ],
  notes: ["notes", "alert notes", "comments"],
};

function norm(h: unknown) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function mapHeaders(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((cell, idx) => {
    const n = norm(cell);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(n) && map[field] === undefined) {
        map[field] = idx;
      }
    }
  });
  return map;
}

export function inferAssetType(name: string, explicit?: string | null): string {
  const e = (explicit ?? "").toLowerCase();
  if (e.includes("noise")) return "NOISE_WALL";
  if (e.includes("drain") || e.includes("culvert")) return "DRAINAGE";
  if (e.includes("underpass") || e.includes("bridge")) return "BRIDGE";

  const n = name.toLowerCase();
  if (/noise\s*wall/.test(n)) return "NOISE_WALL";
  if (/culvert|drain/.test(n)) return "DRAINAGE";
  if (/underpass|bridge/.test(n)) return "BRIDGE";
  const right = name.includes("|") ? name.split("|").pop()!.toLowerCase() : "";
  if (/culvert/.test(right)) return "DRAINAGE";
  if (/noise/.test(right)) return "NOISE_WALL";
  if (/underpass|bridge/.test(right)) return "BRIDGE";
  return "BRIDGE";
}

function cell(row: unknown[], idx: number | undefined) {
  if (idx === undefined) return null;
  const v = row[idx];
  if (v === null || v === undefined || v === "") return null;
  return v;
}

function asString(v: unknown) {
  if (v === null || v === undefined) return null;
  return String(v).trim() || null;
}

function asNumber(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Split "Anderson Road-5571" / "Anderson Road - 5571" into name + code. */
export function parseRoadAssetCode(raw: string | null | undefined): {
  name: string | null;
  code: string | null;
} {
  const s = (raw ?? "").trim();
  if (!s) return { name: null, code: null };
  const m = s.match(/^(.+?)\s*[-–—]\s*([A-Za-z0-9]+)\s*$/);
  if (m) {
    return { name: m[1]!.trim() || null, code: m[2]!.trim() || null };
  }
  // Bare numeric / alphanumeric code only
  if (/^[A-Za-z0-9]+$/.test(s)) return { name: null, code: s };
  return { name: s, code: null };
}

/** Parse Asset Vision-style or simple CSV/XLSX buffers into asset rows. */
export function parseAssetWorkbook(buffer: ArrayBuffer | Buffer): {
  rows: ImportedAssetRow[];
  errors: string[];
} {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) {
    return { rows: [], errors: ["Workbook has no sheets."] };
  }
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  });

  const headerIndex = raw.findIndex((r) => {
    if (!Array.isArray(r)) return false;
    const mapped = mapHeaders(r);
    return mapped.assetNumber !== undefined;
  });

  if (headerIndex < 0) {
    return {
      rows: [],
      errors: [
        'Could not find a header row with a Code / Asset Number column. Expected columns like "Code", "AV ID", "Name", "Road Name", "Parent Asset Name", "Parent Asset Code".',
      ],
    };
  }

  const col = mapHeaders(raw[headerIndex]!);
  const errors: string[] = [];
  const rows: ImportedAssetRow[] = [];
  const seen = new Set<string>();

  for (let i = headerIndex + 1; i < raw.length; i++) {
    const r = raw[i];
    if (!Array.isArray(r)) continue;
    const assetNumber = asString(cell(r, col.assetNumber));
    if (!assetNumber) continue;
    if (seen.has(assetNumber)) {
      errors.push(`Duplicate code skipped: ${assetNumber}`);
      continue;
    }
    seen.add(assetNumber);

    const name =
      asString(cell(r, col.name)) ??
      asString(cell(r, col.parentAssetName)) ??
      assetNumber;
    const typeExplicit = asString(cell(r, col.type));
    const type = inferAssetType(name, typeExplicit);

    const combinedRoad = parseRoadAssetCode(asString(cell(r, col.roadAssetCode)));
    let parentAssetName = asString(cell(r, col.parentAssetName));
    let parentAssetCode = asString(cell(r, col.parentAssetCode));
    if (!parentAssetName && combinedRoad.name) parentAssetName = combinedRoad.name;
    if (!parentAssetCode && combinedRoad.code) parentAssetCode = combinedRoad.code;
    // Parent Asset Code cell sometimes holds "Anderson Road-5571"
    if (parentAssetCode && parentAssetCode.includes("-") && !parentAssetName) {
      const split = parseRoadAssetCode(parentAssetCode);
      if (split.name && split.code) {
        parentAssetName = split.name;
        parentAssetCode = split.code;
      }
    }

    const roadName =
      asString(cell(r, col.roadName)) ??
      parentAssetName ??
      (name.includes("|") ? name.split("|")[0]!.trim() : null);

    const parentChainage = asNumber(cell(r, col.parentChainage));
    let chainageFrom = asNumber(cell(r, col.chainageFrom));
    const chainageTo = asNumber(cell(r, col.chainageTo));
    if (chainageFrom == null && parentChainage != null) {
      chainageFrom = parentChainage;
    }

    const subExplicit =
      asString(cell(r, col.subClassification)) ??
      asString(cell(r, col.classification));
    const subClassification =
      inferAssetSubClass(name, asString(cell(r, col.subClassification))) ??
      inferAssetSubClass(name, typeExplicit) ??
      inferAssetSubClass(name, subExplicit);

    rows.push({
      assetVisionId: asString(cell(r, col.assetVisionId)),
      assetNumber,
      name,
      type,
      roadName,
      location: asString(cell(r, col.location)),
      latitude: asNumber(cell(r, col.latitude)),
      longitude: asNumber(cell(r, col.longitude)),
      parentDirection: asString(cell(r, col.parentDirection)),
      parentChainage: parentChainage ?? chainageFrom,
      chainageFrom,
      chainageTo,
      parentAssetCode,
      parentAssetName,
      classification: asString(cell(r, col.classification)),
      subClassification,
      notes: asString(cell(r, col.notes)),
    });
  }

  if (rows.length === 0) {
    errors.push("No asset rows with a Code were found.");
  }

  return { rows, errors };
}
