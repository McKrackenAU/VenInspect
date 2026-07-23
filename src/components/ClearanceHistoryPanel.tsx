"use client";

import { useEffect, useState } from "react";

type HistoryRow = {
  inspectionId: string;
  titleLabel: string;
  level: string;
  status: string;
  inspectedAt: string;
  measurements: { label: string; value: string }[];
  sag: string;
  rounded: string;
};

export function ClearanceHistoryPanel({ assetId }: { assetId: string }) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/assets/${assetId}/clearance-history`);
        const body = (await res.json()) as {
          history?: HistoryRow[];
          error?: string;
        };
        if (!res.ok) throw new Error(body.error || "Failed to load");
        if (!cancelled) setRows(body.history ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-semibold text-[color:var(--ventia-green)]">
            Clearance history
          </h2>
          <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
            Vertical clearance measurements across past inspections.
          </p>
        </div>
        <a
          href={`/api/assets/${assetId}/clearance-history?format=xlsx`}
          className="rounded-lg border border-[color:var(--ventia-green)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ventia-green)]"
        >
          Download Excel
        </a>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {rows === null && !error ? (
        <p className="text-sm text-[color:var(--ventia-muted)]">Loading…</p>
      ) : null}
      {rows && rows.length === 0 ? (
        <p className="text-sm text-[color:var(--ventia-muted)]">
          No clearance measurements recorded yet.
        </p>
      ) : null}
      {rows && rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.inspectionId}
              className="rounded-xl border border-[color:var(--ventia-border)] p-3 text-sm"
            >
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span className="font-semibold">{row.inspectedAt}</span>
                <span className="text-[color:var(--ventia-muted)]">
                  {row.titleLabel}
                </span>
                <span className="text-xs text-[color:var(--ventia-muted)]">
                  {row.level} · {row.status}
                </span>
              </div>
              <ul className="mt-2 space-y-0.5 text-xs">
                {row.measurements.map((m) => (
                  <li key={m.label}>
                    {m.label}: <strong>{m.value} m</strong>
                  </li>
                ))}
                {row.sag ? (
                  <li>
                    Sag: <strong>{row.sag}</strong>
                  </li>
                ) : null}
                {row.rounded ? (
                  <li>
                    Rounded: <strong>{row.rounded}</strong>
                  </li>
                ) : null}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
