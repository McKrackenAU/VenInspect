"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ExportPdfButton } from "@/components/ExportPdfButton";
import { VentiaPrintLogo } from "@/components/BrandMark";

export type ScopeDefect = {
  id: string;
  defectCode: string;
  description: string;
  comments: string | null;
  severity: string;
  severityLabel: string;
  category: string | null;
  subcategory: string | null;
  photoPath: string | null;
  comparisonPhotoPath: string | null;
};

function photoUrl(path: string) {
  return `/api/uploads/${path.split(/[/\\]/).map(encodeURIComponent).join("/")}`;
}

export function ScopeDefectPicker({
  inspectionId,
  titleLabel,
  roadName,
  assetNumber,
  assetName,
  submittedAtIso,
  inspectorName,
  defects,
}: {
  inspectionId: string;
  titleLabel: string;
  roadName: string;
  assetNumber: string;
  assetName: string;
  submittedAtIso: string;
  inspectorName: string;
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
      <div className="no-print flex flex-wrap items-center gap-2">
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
        <ExportPdfButton
          inspectionId={inspectionId}
          defectIds={chosen.map((d) => d.id)}
          label="Export scope PDF"
          className="ml-auto rounded-md bg-[color:var(--ventia-green)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        />
      </div>

      <ul className="no-print space-y-2">
        {defects.map((d) => (
          <li
            key={d.id}
            className="flex items-start gap-3 rounded-lg border border-[color:var(--ventia-border)] bg-[color:var(--panel)] px-3 py-2"
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
                  {d.severityLabel}
                </span>
              </p>
              <p className="text-sm">{d.description}</p>
            </div>
          </li>
        ))}
      </ul>

      <article className="scope-sheet mx-auto max-w-3xl rounded-xl border border-[color:var(--ventia-border)] bg-white p-8 text-slate-900 shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none">
        <header className="border-b-2 border-[color:var(--ventia-green)] pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                VenInspect · Works scope
              </p>
              <h1 className="mt-2 text-xl font-bold text-[color:var(--ventia-green)]">
                {assetNumber} — {assetName}
              </h1>
            </div>
            <VentiaPrintLogo />
          </div>
          <p className="mt-1 text-sm text-slate-600">{titleLabel}</p>
          <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
            <div>
              <span className="text-[color:var(--ventia-muted)]">Road: </span>
              {roadName}
            </div>
            <div>
              <span className="text-[color:var(--ventia-muted)]">Inspected: </span>
              {format(new Date(submittedAtIso), "dd MMM yyyy")}
            </div>
            <div>
              <span className="text-[color:var(--ventia-muted)]">Inspector: </span>
              {inspectorName}
            </div>
            <div>
              <span className="text-[color:var(--ventia-muted)]">Defects in scope: </span>
              <strong>{chosen.length}</strong> of {defects.length}
            </div>
          </dl>
        </header>

        {chosen.length === 0 ? (
          <p className="mt-6 text-sm text-[color:var(--ventia-muted)]">
            No defects selected.
          </p>
        ) : (
          <ol className="mt-6 list-none space-y-5 p-0">
            {chosen.map((d, index) => (
              <li
                key={d.id}
                className="break-inside-avoid rounded-lg border border-[color:var(--ventia-border)] p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-base font-bold text-[color:var(--ventia-green)]">
                    {index + 1}. {d.defectCode}
                  </p>
                  <span className="rounded-full bg-[color:var(--ventia-green-tint)] px-2 py-0.5 text-xs font-semibold uppercase text-[color:var(--ventia-green)]">
                    {d.severityLabel}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium">{d.description}</p>
                {d.comments ? (
                  <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
                    {d.comments}
                  </p>
                ) : null}
                {(d.category || d.subcategory) && (
                  <p className="mt-1 text-xs text-[color:var(--ventia-muted)]">
                    Location: {[d.category, d.subcategory].filter(Boolean).join(" · ")}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-4">
                  {d.comparisonPhotoPath ? (
                    <figure>
                      <figcaption className="text-[0.65rem] uppercase tracking-wide text-[color:var(--ventia-muted)]">
                        Prior condition
                      </figcaption>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoUrl(d.comparisonPhotoPath)}
                        alt="Prior"
                        className="mt-1 max-h-44 rounded border border-[color:var(--ventia-border)] object-contain"
                      />
                    </figure>
                  ) : null}
                  {d.photoPath ? (
                    <figure>
                      <figcaption className="text-[0.65rem] uppercase tracking-wide text-[color:var(--ventia-muted)]">
                        {d.comparisonPhotoPath ? "Current condition" : "Photo"}
                      </figcaption>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoUrl(d.photoPath)}
                        alt={d.defectCode}
                        className="mt-1 max-h-44 rounded border border-[color:var(--ventia-border)] object-contain"
                      />
                    </figure>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}

        <footer className="mt-8 border-t border-[color:var(--ventia-border)] pt-3 text-xs text-[color:var(--ventia-muted)]">
          VenInspect works scope · print or save as PDF from your browser
        </footer>
      </article>
    </div>
  );
}
