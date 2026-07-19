"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";

export type ScopeDefect = {
  id: string;
  defectCode: string;
  description: string;
  comments: string | null;
  severity: string;
  category: string | null;
  subcategory: string | null;
  photoPath: string | null;
};

export function ScopeDefectPicker({
  titleLabel,
  roadName,
  assetNumber,
  submittedAtIso,
  defects,
}: {
  titleLabel: string;
  roadName: string;
  assetNumber: string;
  submittedAtIso: string;
  defects: ScopeDefect[];
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defects.map((d) => d.id)),
  );

  const chosen = useMemo(
    () => defects.filter((d) => selected.has(d.id)),
    [defects, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll(on: boolean) {
    setSelected(on ? new Set(defects.map((d) => d.id)) : new Set());
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button
          type="button"
          onClick={() => selectAll(true)}
          className="rounded-md border border-[color:var(--ventia-border)] px-3 py-1.5 text-xs"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={() => selectAll(false)}
          className="rounded-md border border-[color:var(--ventia-border)] px-3 py-1.5 text-xs"
        >
          Clear
        </button>
        <span className="text-xs text-[color:var(--ventia-muted)]">
          {chosen.length} of {defects.length} selected
        </span>
        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto rounded-md bg-[color:var(--ventia-green)] px-3 py-1.5 text-sm font-medium text-white"
        >
          Export scope (Print / PDF)
        </button>
      </div>

      <ul className="space-y-2 print:hidden">
        {defects.map((d) => (
          <li
            key={d.id}
            className="flex items-start gap-3 rounded-lg border border-[color:var(--ventia-border)] bg-white px-3 py-2"
          >
            <input
              type="checkbox"
              checked={selected.has(d.id)}
              onChange={() => toggle(d.id)}
              className="mt-1 accent-[color:var(--ventia-green)]"
            />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-semibold text-[color:var(--ventia-green)]">
                {d.defectCode}{" "}
                <span className="font-sans text-xs uppercase text-[color:var(--ventia-muted)]">
                  {d.severity}
                </span>
              </p>
              <p className="text-sm">{d.description}</p>
            </div>
          </li>
        ))}
      </ul>

      <article className="rounded-xl border border-[color:var(--ventia-border)] bg-white p-8 text-[color:var(--ventia-ink)] shadow-sm print:border-0 print:shadow-none">
        <header className="border-b border-[color:var(--ventia-border)] pb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--ventia-muted)]">
            VenInspect · Works scope (selected defects)
          </p>
          <h1 className="mt-2 text-xl font-bold">{titleLabel}</h1>
          <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
            {roadName} · {assetNumber} · submitted{" "}
            {format(new Date(submittedAtIso), "dd MMM yyyy HH:mm:ss")}
          </p>
          <p className="mt-2 text-sm">
            Scope includes <strong>{chosen.length}</strong> of {defects.length} recorded
            defects.
          </p>
        </header>

        {chosen.length === 0 ? (
          <p className="mt-6 text-sm text-[color:var(--ventia-muted)]">
            No defects selected.
          </p>
        ) : (
          <ol className="mt-6 list-decimal space-y-4 pl-5 text-sm">
            {chosen.map((d) => (
              <li key={d.id} className="pl-1">
                <p className="font-mono font-bold">{d.defectCode}</p>
                <p className="mt-1">{d.description}</p>
                {d.comments && (
                  <p className="mt-1 text-[color:var(--ventia-muted)]">{d.comments}</p>
                )}
                <p className="mt-1 text-xs text-[color:var(--ventia-muted)]">
                  Severity: {d.severity}
                  {d.category ? ` · ${d.category}` : ""}
                  {d.subcategory ? ` / ${d.subcategory}` : ""}
                </p>
                {d.photoPath && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/uploads/${d.photoPath.split(/[/\\]/).map(encodeURIComponent).join("/")}`}
                    alt={d.defectCode}
                    className="mt-2 max-h-40 rounded border border-[color:var(--ventia-border)] object-contain"
                  />
                )}
              </li>
            ))}
          </ol>
        )}
      </article>
    </div>
  );
}
