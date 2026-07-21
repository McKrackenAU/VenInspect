"use client";

import { useState } from "react";

export function ExportPdfButton({
  inspectionId,
  defectIds,
  label = "Export PDF",
  className,
}: {
  inspectionId: string;
  /** When set, exports a scope PDF with only these defect ids */
  defectIds?: string[];
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const qs =
        defectIds && defectIds.length > 0
          ? `?defects=${defectIds.map(encodeURIComponent).join(",")}`
          : "";
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

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy || (defectIds != null && defectIds.length === 0)}
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
