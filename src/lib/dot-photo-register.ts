/**
 * DoT-style photo register naming: {assetDigits}{YYMMDD}{seqPad2+}
 * Example: SN6150 + 2026-04-16 + photo 13 → 615026041613
 */
export function assetDigits(assetNumber: string): string {
  const digits = assetNumber.replace(/\D/g, "");
  return digits || sanitizeAlpha(assetNumber);
}

function sanitizeAlpha(s: string) {
  return s.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "ASSET";
}

export function formatDotPhotoName(opts: {
  assetNumber: string;
  takenAt: Date;
  sequence: number;
}): string {
  const digits = assetDigits(opts.assetNumber);
  const y = String(opts.takenAt.getFullYear()).slice(-2);
  const m = String(opts.takenAt.getMonth() + 1).padStart(2, "0");
  const d = String(opts.takenAt.getDate()).padStart(2, "0");
  const seq = String(opts.sequence).padStart(2, "0");
  return `${digits}${y}${m}${d}${seq}`;
}

export type PhotoRegisterRow = {
  number: number;
  fileName: string;
  date: string;
  description: string;
  defectRef?: string;
  key: string;
};

export function buildPhotoRegister(opts: {
  assetNumber: string;
  inspectedAt: Date;
  items: {
    key: string;
    description: string;
    defectCode?: string;
    takenAt?: Date;
  }[];
}): PhotoRegisterRow[] {
  return opts.items.map((item, i) => {
    const seq = i + 1;
    const taken = item.takenAt ?? opts.inspectedAt;
    return {
      number: seq,
      fileName: formatDotPhotoName({
        assetNumber: opts.assetNumber,
        takenAt: taken,
        sequence: seq,
      }),
      date: `${String(taken.getDate()).padStart(2, "0")}/${String(taken.getMonth() + 1).padStart(2, "0")}/${taken.getFullYear()}`,
      description: item.description,
      defectRef: item.defectCode,
      key: item.key,
    };
  });
}

export const DEFAULT_TREATMENT_TYPES = [
  { value: "REPAIR", label: "Repair" },
  { value: "INVESTIGATION", label: "Investigation" },
  { value: "MONITORING", label: "Monitoring" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "REPLACEMENT", label: "Replacement" },
];
