"use client";

import { useMemo, useState } from "react";

type Point = { label: string; at: string; cs1: number; cs2: number; cs3: number; cs4: number; qty: number };

export function ComponentCsHistoryChart({ series }: { series: Point[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return series;
    return series.filter((p) => p.label.toLowerCase().includes(needle));
  }, [series, q]);

  const byLabel = useMemo(() => {
    const map = new Map<string, Point[]>();
    for (const p of filtered) {
      const list = map.get(p.label) ?? [];
      list.push(p);
      map.set(p.label, list);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="space-y-4">
      <input
        className="field-input w-full max-w-md"
        placeholder="Search component…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {byLabel.length === 0 ? (
        <p className="text-sm text-[color:var(--ventia-muted)]">No history yet.</p>
      ) : (
        byLabel.map(([label, points]) => {
          const maxQty = Math.max(1, ...points.map((p) => p.qty || 1));
          return (
            <div key={label} className="rounded-xl border border-[color:var(--ventia-border)] p-4">
              <h3 className="font-semibold text-[color:var(--ventia-green)]">{label}</h3>
              <div className="mt-3 flex items-end gap-2 overflow-x-auto pb-2">
                {points.map((p) => {
                  const h = Math.max(8, Math.round(((p.cs2 + p.cs3 + p.cs4) / maxQty) * 80));
                  return (
                    <div key={p.at + p.label} className="flex w-14 flex-col items-center gap-1">
                      <div
                        className="w-8 rounded-t bg-[color:var(--ventia-green)]"
                        style={{ height: h }}
                        title={`CS2-4 qty ${p.cs2 + p.cs3 + p.cs4} / ${p.qty}`}
                      />
                      <span className="text-[9px] text-[color:var(--ventia-muted)]">
                        {p.at.slice(0, 10)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <ul className="mt-2 space-y-1 text-xs text-[color:var(--ventia-muted)]">
                {points.map((p) => (
                  <li key={`${p.at}-row`}>
                    {p.at.slice(0, 10)}: qty {p.qty} · CS {p.cs1}/{p.cs2}/{p.cs3}/{p.cs4}
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}
