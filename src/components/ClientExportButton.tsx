"use client";

import { useState } from "react";
import type { SeverityOption } from "@/lib/severities";
import {
  ExportConditionDialog,
  useExportDownload,
} from "@/components/ExportConditionDialog";

export function ClientExportButton({
  inspectionId,
  conditionStates,
  defaultSelected,
  className,
}: {
  inspectionId: string;
  conditionStates: SeverityOption[];
  defaultSelected: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const { busy, error, setError, downloadBlob } = useExportDownload();

  async function runExport() {
    if (selected.length === 0) {
      setError("Select at least one condition state");
      return;
    }
    const qs = `?severities=${selected.map(encodeURIComponent).join(",")}`;
    const ok = await downloadBlob(
      `/api/inspections/${inspectionId}/client-export${qs}`,
      "client-export.zip",
    );
    if (ok) setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setError(null);
          setSelected(defaultSelected);
          setOpen(true);
        }}
        className={
          className ??
          "rounded-md border border-[color:var(--ventia-green)] px-3 py-2 text-sm font-semibold text-[color:var(--ventia-green)] disabled:opacity-50"
        }
      >
        {busy && !open ? "Building pack…" : "Client Export"}
      </button>

      <ExportConditionDialog
        open={open}
        title="Client Export"
        description="Builds a ZIP with the report PDF, photos, and index for the condition states you select."
        states={conditionStates}
        selected={selected}
        onSelectedChange={setSelected}
        busy={busy}
        error={error}
        confirmLabel="Build Client Export"
        onConfirm={() => void runExport()}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
      />
    </>
  );
}
