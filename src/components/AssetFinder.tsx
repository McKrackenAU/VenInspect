"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";

type AssetRow = {
  id: string;
  assetNumber: string;
  name: string;
  roadName: string;
  typeLabel: string;
  reportCount: number;
  nextDueLabel: string | null;
};

export function AssetFinder({ assets }: { assets: AssetRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return assets;
    return assets.filter(
      (a) =>
        a.assetNumber.toLowerCase().includes(term) ||
        a.name.toLowerCase().includes(term) ||
        a.roadName.toLowerCase().includes(term),
    );
  }, [assets, q]);

  const byRoad = useMemo(() => {
    const map = new Map<string, AssetRow[]>();
    for (const a of filtered) {
      const list = map.get(a.roadName) ?? [];
      list.push(a);
      map.set(a.roadName, list);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Search</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Road name or code (SN…)"
          className="field-input"
          autoFocus
        />
      </label>

      <p className="text-sm text-[color:var(--ventia-muted)]">
        {filtered.length} found
      </p>

      <div className="space-y-4">
        {byRoad.map(([road, list]) => (
          <section key={road} className="card overflow-hidden">
            <h2 className="border-b border-[color:var(--ventia-border)] bg-[color:var(--ventia-green-tint)] px-4 py-2.5 text-sm font-semibold text-[color:var(--ventia-green)]">
              {road}
            </h2>
            <ul className="divide-y divide-[color:var(--ventia-border)]">
              {list.map((a) => (
                <li key={a.id}>
                  <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <Link href={`/assets/${a.id}`} className="min-w-0 flex-1">
                      <p className="font-mono text-base font-bold text-[color:var(--ventia-green)]">
                        {a.assetNumber}
                      </p>
                      <p className="text-sm">{a.name}</p>
                      <p className="text-xs text-[color:var(--ventia-muted)]">
                        {a.typeLabel}
                        {a.nextDueLabel ? ` · ${a.nextDueLabel}` : ""} · {a.reportCount}{" "}
                        report{a.reportCount === 1 ? "" : "s"}
                      </p>
                    </Link>
                    <Link
                      href={`/inspect?assetId=${a.id}`}
                      className="inline-flex min-h-[2.75rem] shrink-0 items-center justify-center rounded-xl bg-[color:var(--ventia-green)] px-4 text-sm font-semibold text-white"
                    >
                      Inspect
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {byRoad.length === 0 && (
          <p className="card px-4 py-8 text-center text-[color:var(--ventia-muted)]">
            Nothing matches. Check the code or try the road name.
          </p>
        )}
      </div>
    </div>
  );
}

export function formatNextDue(
  status: string,
  nextDueAt: Date | null,
): string | null {
  if (status === "overdue") return "Overdue";
  if (status === "due_soon" && nextDueAt) {
    return `Due soon (${format(nextDueAt, "dd MMM")})`;
  }
  return null;
}
