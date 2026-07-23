import * as XLSX from "xlsx";

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
  parentAssetCode: string | null;
  parentAssetName: string | null;
  classification: string | null;
  notes: string | null;
};

const HEADER_ALIASES: Record<string, string[]> = {
  assetVisionId: ["asset id", "assetvisionid", "asset vision id", "avid"],
  assetNumber: ["code", "asset number", "assetnumber", "serial", "sn"],
  name: ["name", "asset name", "description"],
  type: ["type", "asset type", "structure type"],
  roadName: ["parent asset name", "road", "road name", "roadname"],
  location: ["location", "site", "address"],
  latitude: ["latitude", "lat", "y"],
  longitude: ["longitude", "lng", "lon", "long", "x"],
  parentDirection: ["parent direction", "direction"],
  parentChainage: ["parent chainage", "chainage"],
  parentAssetCode: ["parent asset code"],
  parentAssetName: ["parent asset name"],
  classification: ["classification"],
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
  if (e.includes("bridge")) return "BRIDGE";

  const n = name.toLowerCase();
  if (/noise\s*wall/.test(n)) return "NOISE_WALL";
  if (/culvert|drain/.test(n)) return "DRAINAGE";
  if (/bridge/.test(n)) return "BRIDGE";
  const right = name.includes("|") ? name.split("|").pop()!.toLowerCase() : "";
  if (/culvert/.test(right)) return "DRAINAGE";
  if (/noise/.test(right)) return "NOISE_WALL";
  if (/bridge/.test(right)) return "BRIDGE";
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

/** Parse Asset Vision-style or simple CSV/XLSX buffers into asset rows. */
export function parseAssetWorkbook(buffer: ArrayBuffer | Buffer): {
  rows: ImportedAssetRow[];
  errors: string[];
} {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  });

  let headerIndex = raw.findIndex((r) => {
    if (!Array.isArray(r)) return false;
    const mapped = mapHeaders(r);
    return mapped.assetNumber !== undefined;
  });

  if (headerIndex < 0) {
    return {
      rows: [],
      errors: [
        'Could not find a header row with a Code / Asset Number column. Expected Asset Vision export columns like "Asset ID", "Code", "Name".',
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
    const type = inferAssetType(name, asString(cell(r, col.type)));
    const parentAssetName = asString(cell(r, col.parentAssetName));
    const roadName =
      asString(cell(r, col.roadName)) ??
      parentAssetName ??
      (name.includes("|") ? name.split("|")[0]!.trim() : null);

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
      parentChainage: asNumber(cell(r, col.parentChainage)),
      parentAssetCode: asString(cell(r, col.parentAssetCode)),
      parentAssetName,
      classification: asString(cell(r, col.classification)),
      notes: asString(cell(r, col.notes)),
    });
  }

  if (rows.length === 0) {
    errors.push("No asset rows with a Code were found.");
  }

  return { rows, errors };
}
