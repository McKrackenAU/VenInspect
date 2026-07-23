"use client";

import { useMemo, useState } from "react";
import type { SeverityOption } from "@/lib/severities";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(defaultSelected);

  const allCodes = useMemo(
    () => conditionStates.map((s) => s.value),
    [conditionStates],
  );

  function toggle(code: string) {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  async function download() {
    if (selected.length === 0) {
      setError("Select at least one condition state");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const qs = `?severities=${selected.map(encodeURIComponent).join(",")}`;
      const res = await fetch(
        `/api/inspections/${inspectionId}/client-export${qs}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(cd);
      const name = match?.[1] || "client-export.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col gap-2 rounded-xl border border-[color:var(--ventia-border)] p-3">
      <p className="text-xs font-semibold text-[color:var(--ventia-muted)]">
        Client Export — condition states to include
      </p>
      <ul className="space-y-1">
        {conditionStates.map((s) => (
          <li key={s.value}>
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={selected.includes(s.value)}
                onChange={() => toggle(s.value)}
                className="mt-0.5 accent-[color:var(--ventia-green)]"
              />
              <span>
                <span className="font-medium">{s.label}</span>
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
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="text-[10px] font-semibold text-[color:var(--ventia-blue)]"
          onClick={() => setSelected(allCodes)}
        >
          All
        </button>
        <button
          type="button"
          className="text-[10px] font-semibold text-[color:var(--ventia-blue)]"
          onClick={() => setSelected([])}
        >
          None
        </button>
      </div>
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        className={
          className ??
          "rounded-lg border border-[color:var(--ventia-green)] px-3 py-2 text-sm font-semibold text-[color:var(--ventia-green)]"
        }
      >
        {busy ? "Building pack…" : "Client Export"}
      </button>
      {error ? <span className="text-xs text-rose-700">{error}</span> : null}
    </div>
  );
}
