"use client";

import { useEffect, useMemo, useState } from "react";
import type { SeverityOption } from "@/lib/severities";

/** Shared condition-state picker dialog for PDF / Client Export. */
export function ExportConditionDialog({
  open,
  title,
  description,
  states,
  selected,
  onSelectedChange,
  busy,
  error,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  states: SeverityOption[];
  selected: string[];
  onSelectedChange: (next: string[]) => void;
  busy: boolean;
  error: string | null;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const allCodes = useMemo(() => states.map((s) => s.value), [states]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-condition-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] shadow-xl">
        <div className="space-y-1 border-b border-[color:var(--ventia-border)] px-5 py-4">
          <h3
            id="export-condition-title"
            className="text-lg font-semibold text-[color:var(--ventia-green)]"
          >
            {title}
          </h3>
          {description ? (
            <p className="text-sm text-[color:var(--ventia-muted)]">{description}</p>
          ) : null}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ventia-muted)]">
            Condition states to include
          </p>
          <ul className="space-y-2">
            {states.map((s) => (
              <li key={s.value}>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[color:var(--ventia-border)] px-3 py-2.5 hover:border-[color:var(--ventia-green)]">
                  <input
                    type="checkbox"
                    checked={selected.includes(s.value)}
                    onChange={() =>
                      onSelectedChange(
                        selected.includes(s.value)
                          ? selected.filter((c) => c !== s.value)
                          : [...selected, s.value],
                      )
                    }
                    className="mt-1 accent-[color:var(--ventia-green)]"
                  />
                  <span className="text-sm">
                    <span className="font-medium">{s.label}</span>
                    {s.description ? (
                      <span className="mt-0.5 block text-xs text-[color:var(--ventia-muted)]">
                        {s.description}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            <button
              type="button"
              className="text-xs font-semibold text-[color:var(--ventia-blue)]"
              onClick={() => onSelectedChange(allCodes)}
            >
              All
            </button>
            <button
              type="button"
              className="text-xs font-semibold text-[color:var(--ventia-blue)]"
              onClick={() => onSelectedChange([])}
            >
              None
            </button>
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[color:var(--ventia-border)] px-5 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-[color:var(--ventia-border)] px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || selected.length === 0}
            onClick={onConfirm}
            className="rounded-lg bg-[color:var(--ventia-green)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useExportDownload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadBlob(url: string, fallbackName: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(cd);
      const name = match?.[1] || fallbackName;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, setError, downloadBlob };
}
