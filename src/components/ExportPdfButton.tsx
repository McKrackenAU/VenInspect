"use client";

import { useState } from "react";
import type { SeverityOption } from "@/lib/severities";
import {
  ExportConditionDialog,
  useExportDownload,
} from "@/components/ExportConditionDialog";

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
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(defaultSelected ?? []);
  const { busy, error, setError, downloadBlob } = useExportDownload();
  const states = conditionStates ?? [];
  const showFilter = allowConditionFilter && states.length > 0 && !defectIds;

  async function runExport(severities?: string[]) {
    const params = new URLSearchParams();
    if (defectIds && defectIds.length > 0) {
      params.set("defects", defectIds.join(","));
    } else if (severities && severities.length > 0) {
      params.set("severities", severities.join(","));
    }
    const qs = params.toString() ? `?${params}` : "";
    const ok = await downloadBlob(
      `/api/inspections/${inspectionId}/pdf${qs}`,
      "inspection-report.pdf",
    );
    if (ok) setOpen(false);
  }

  const buttonClass =
    className ??
    "rounded-md bg-[color:var(--ventia-green)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50";

  return (
    <>
      <button
        type="button"
        disabled={busy || (defectIds != null && defectIds.length === 0)}
        onClick={() => {
          setError(null);
          if (showFilter) {
            setSelected(defaultSelected ?? selected);
            setOpen(true);
            return;
          }
          void runExport();
        }}
        className={buttonClass}
      >
        {busy && !open ? "Generating…" : label}
      </button>

      {showFilter ? (
        <ExportConditionDialog
          open={open}
          title="Export PDF"
          description="Choose which condition states appear in the PDF photographic record and defect list."
          states={states}
          selected={selected}
          onSelectedChange={setSelected}
          busy={busy}
          error={error}
          confirmLabel="Export PDF"
          onConfirm={() => void runExport(selected)}
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        />
      ) : null}

      {!open && error ? (
        <span className="mt-1 block max-w-[16rem] text-right text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </>
  );
}
