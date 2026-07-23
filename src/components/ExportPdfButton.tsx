"use client";

import { useMemo, useState } from "react";
import type { SeverityOption } from "@/lib/severities";

export function ExportPdfButton({
  inspectionId,
  defectIds,
  label = "Export PDF",
  className,
  conditionStates,
  defaultSelected,
  allowConditionFilter = false,
}: {
  inspectionId: string;
  /** When set, exports a scope PDF with only these defect ids */
  defectIds?: string[];
  label?: string;
  className?: string;
  conditionStates?: SeverityOption[];
  defaultSelected?: string[];
  allowConditionFilter?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(defaultSelected ?? []);
  const states = conditionStates ?? [];

  const showFilter = allowConditionFilter && states.length > 0 && !defectIds;

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (defectIds && defectIds.length > 0) {
        params.set("defects", defectIds.join(","));
      } else if (showFilter && selected.length > 0) {
        params.set("severities", selected.join(","));
      }
      const qs = params.toString() ? `?${params}` : "";
      const res = await fetch(`/api/inspections/${inspectionId}/pdf${qs}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(cd);
      const name = match?.[1] || "inspection-report.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  const allCodes = useMemo(() => states.map((s) => s.value), [states]);

  return (
    <span className="inline-flex flex-col items-end gap-2">
      {showFilter ? (
        <div className="max-w-xs rounded-xl border border-[color:var(--ventia-border)] p-2 text-left">
          <p className="mb-1 text-[10px] font-semibold text-[color:var(--ventia-muted)]">
            Condition states in PDF
          </p>
          <ul className="space-y-1">
            {states.map((s) => (
              <li key={s.value}>
                <label className="flex items-start gap-1.5 text-[11px]">
                  <input
                    type="checkbox"
                    checked={selected.includes(s.value)}
                    onChange={() =>
                      setSelected((prev) =>
                        prev.includes(s.value)
                          ? prev.filter((c) => c !== s.value)
                          : [...prev, s.value],
                      )
                    }
                    className="mt-0.5 accent-[color:var(--ventia-green)]"
                  />
                  <span>
                    {s.label}
                    {s.description ? (
                      <span className="block text-[color:var(--ventia-muted)]">
                        {s.description}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              className="text-[10px] text-[color:var(--ventia-blue)]"
              onClick={() => setSelected(allCodes)}
            >
              All
            </button>
            <button
              type="button"
              className="text-[10px] text-[color:var(--ventia-blue)]"
              onClick={() => setSelected([])}
            >
              None
            </button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        disabled={
          busy ||
          (defectIds != null && defectIds.length === 0) ||
          (showFilter && selected.length === 0)
        }
        onClick={() => void download()}
        className={
          className ??
          "rounded-md bg-[color:var(--ventia-green)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        }
      >
        {busy ? "Generating…" : label}
      </button>
      {error ? (
        <span className="max-w-[16rem] text-right text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </span>
  );
}
