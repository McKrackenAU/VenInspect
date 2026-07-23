/** Client-safe CSV parsers for import UIs (no node / xlsx). */

export function parseComponentsCsv(text: string): {
  name: string;
  category?: string;
  qty?: string;
  unit?: string;
}[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const split = (line: string) => {
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        cells.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  };
  const header = split(lines[0]).map((h) => h.toLowerCase());
  const nameIdx = header.findIndex((h) => h === "name" || h === "component");
  const catIdx = header.findIndex((h) => h === "category");
  const qtyIdx = header.findIndex((h) => h === "qty" || h === "quantity");
  const unitIdx = header.findIndex((h) => h === "unit");
  if (nameIdx < 0) {
    throw new Error("Components template must include a name column");
  }
  const rows: {
    name: string;
    category?: string;
    qty?: string;
    unit?: string;
  }[] = [];
  for (const line of lines.slice(1)) {
    const cells = split(line);
    const name = (cells[nameIdx] ?? "").trim();
    if (!name) continue;
    rows.push({
      name,
      category: catIdx >= 0 ? cells[catIdx]?.trim() || undefined : undefined,
      qty: qtyIdx >= 0 ? cells[qtyIdx]?.trim() || undefined : undefined,
      unit: unitIdx >= 0 ? cells[unitIdx]?.trim() || undefined : undefined,
    });
  }
  return rows;
}
