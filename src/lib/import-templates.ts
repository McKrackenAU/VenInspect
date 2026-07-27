/** Blank CSV / XLSX templates for admin imports. */

import * as XLSX from "xlsx";

export const ASSET_REGISTRY_TEMPLATE_HEADERS = [
  "Code",
  "AV ID",
  "Name",
  "Road Name",
  "Type",
  "Sub Classification",
  "Location",
  "Latitude",
  "Longitude",
  "Classification",
  "Chainage From",
  "Chainage To",
  "Notes",
] as const;

export const ASSET_AUDIT_TEMPLATE_HEADERS = [
  "Display Name",
  "New Value",
  "Date",
] as const;

export const ASSET_COMPONENTS_TEMPLATE_HEADERS = [
  "name",
  "category",
  "qty",
  "unit",
] as const;

export function csvFromHeaders(
  headers: readonly string[],
  sampleRows: string[][] = [],
): string {
  const lines = [
    headers.join(","),
    ...sampleRows.map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(","),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

export function xlsxBufferFromHeaders(
  sheetName: string,
  headers: readonly string[],
  sampleRows: string[][] = [],
): Buffer {
  const data = [headers as unknown as string[], ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
