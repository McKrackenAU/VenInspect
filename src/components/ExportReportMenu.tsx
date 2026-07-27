"use client";

import { useEffect, useRef, useState } from "react";
import type { SeverityOption } from "@/lib/severities";
import {
  ExportConditionDialog,
  useExportDownload,
} from "@/components/ExportConditionDialog";

type ExportFormat = "pdf" | "excel";

/**
 * Single Export control with PDF / Excel choices (optional condition-state filter).
 */
export function ExportReportMenu({
  inspectionId,
  defectIds,
  label = "Export",
  className,
  conditionStates,
  defaultSelected,
  allowConditionFilter = false,
}: {
  inspectionId: string;
  /** When set, exports a scope pack with only these defect ids */
  defectIds?: string[];
  label?: string;
  className?: string;
  conditionStates?: SeverityOption[];
  defaultSelected?: string[];
  allowConditionFilter?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<ExportFormat>("pdf");
  const [selected, setSelected] = useState<string[]>(defaultSelected ?? []);
  const rootRef = useRef<HTMLDivElement>(null);
  const { busy, error, setError, downloadBlob } = useExportDownload();
  const states = conditionStates ?? [];
  const showFilter = allowConditionFilter && states.length > 0 && !defectIds;

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function runExport(format: ExportFormat, severities?: string[]) {
    const params = new URLSearchParams();
    if (defectIds && defectIds.length > 0) {
      params.set("defects", defectIds.join(","));
    } else if (severities && severities.length > 0) {
      params.set("severities", severities.join(","));
    }
    const qs = params.toString() ? `?${params}` : "";
    const path =
      format === "excel"
        ? `/api/inspections/${inspectionId}/excel${qs}`
        : `/api/inspections/${inspectionId}/pdf${qs}`;
    const fallback =
      format === "excel" ? "inspection-report.xlsx" : "inspection-report.pdf";
    const ok = await downloadBlob(path, fallback);
    if (ok) {
      setFilterOpen(false);
      setMenuOpen(false);
    }
  }

  function chooseFormat(format: ExportFormat) {
    setError(null);
    setMenuOpen(false);
    if (showFilter) {
      setPendingFormat(format);
      setSelected(defaultSelected ?? selected);
      setFilterOpen(true);
      return;
    }
    void runExport(format);
  }

  const buttonClass =
    className ??
    "inline-flex items-center gap-1.5 rounded-md bg-[color:var(--ventia-green)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50";

  return (
    <div ref={rootRef} className="relative inline-flex flex-col items-end">
      <button
        type="button"
        disabled={busy || (defectIds != null && defectIds.length === 0)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => {
          setError(null);
          setMenuOpen((v) => !v);
        }}
        className={buttonClass}
      >
        {busy && !filterOpen ? "Generating…" : label}
        <span aria-hidden className="text-[10px] opacity-90">
          ▾
        </span>
      </button>

      {menuOpen ? (
        <div
          role="menu"
          aria-label="Export format"
          className="absolute right-0 top-full z-40 mt-1 min-w-[10.5rem] overflow-hidden rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2 text-left text-sm font-semibold text-[color:var(--ventia-ink)] hover:bg-[color:var(--ventia-green-tint)]"
            onClick={() => chooseFormat("pdf")}
          >
            PDF
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2 text-left text-sm font-semibold text-[color:var(--ventia-ink)] hover:bg-[color:var(--ventia-green-tint)]"
            onClick={() => chooseFormat("excel")}
          >
            Excel
          </button>
        </div>
      ) : null}

      {showFilter ? (
        <ExportConditionDialog
          open={filterOpen}
          title={pendingFormat === "excel" ? "Export Excel" : "Export PDF"}
          description="Choose which condition states appear in the photographic record and defect list."
          states={states}
          selected={selected}
          onSelectedChange={setSelected}
          busy={busy}
          error={error}
          confirmLabel={
            pendingFormat === "excel" ? "Export Excel" : "Export PDF"
          }
          onConfirm={() => void runExport(pendingFormat, selected)}
          onClose={() => {
            if (!busy) setFilterOpen(false);
          }}
        />
      ) : null}

      {!filterOpen && error ? (
        <span className="mt-1 block max-w-[16rem] text-right text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </div>
  );
}
