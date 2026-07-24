"use client";

import { useState } from "react";

const IMPORT_MODES = [
  {
    value: "context",
    label: "Context only",
    hint: "Parse sheet names + References; append a note on the asset.",
  },
  {
    value: "references",
    label: "References lists",
    hint: "Pull dropdown lists from the References sheet for future templates.",
  },
  {
    value: "preview",
    label: "Full preview",
    hint: "Summarise Condition Rating and Defect & Treatment row counts.",
  },
] as const;

export function DotWorkbookImport({ assetId }: { assetId?: string }) {
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<(typeof IMPORT_MODES)[number]["value"]>(
    "context",
  );
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const modeMeta = IMPORT_MODES.find((m) => m.value === mode) ?? IMPORT_MODES[0];

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        Import mode
        <select
          className="field-input mt-1 w-full"
          value={mode}
          onChange={(e) =>
            setMode(e.target.value as (typeof IMPORT_MODES)[number]["value"])
          }
          disabled={pending}
        >
          {IMPORT_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-[color:var(--ventia-muted)]">{modeMeta.hint}</p>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[color:var(--ventia-green)] bg-[color:var(--ventia-green-tint)] px-4 py-8 text-center">
        <span className="text-sm font-bold text-[color:var(--ventia-green)]">
          {pending ? "Parsing workbook…" : "Choose DoT / Level 2 .xlsx"}
        </span>
        <span className="text-xs text-[color:var(--ventia-muted)]">
          Cover · Condition Rating · Structure Defect & Treatment · References
        </span>
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={pending}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setPending(true);
            setResult(null);
            setError(null);
            const fd = new FormData();
            fd.set("file", file);
            fd.set("mode", mode);
            if (assetId) fd.set("assetId", assetId);
            void fetch("/api/manage/dot-import", { method: "POST", body: fd })
              .then(async (res) => {
                const body = (await res.json()) as {
                  error?: string;
                  sheetNames?: string[];
                  referencesCount?: number;
                  defectRows?: number;
                  conditionRows?: number;
                  message?: string;
                };
                if (!res.ok) throw new Error(body.error || "Import failed");
                setResult(
                  body.message ||
                    `Sheets: ${(body.sheetNames ?? []).join(", ")}. References: ${body.referencesCount ?? 0}. Condition rows: ${body.conditionRows ?? 0}. Defect rows: ${body.defectRows ?? 0}.`,
                );
              })
              .catch((err) =>
                setError(err instanceof Error ? err.message : "Import failed"),
              )
              .finally(() => setPending(false));
          }}
        />
      </label>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {result ? (
        <div className="rounded-lg border border-[color:var(--ventia-border)] bg-[color:var(--panel)] px-3 py-2 text-sm text-[color:var(--ventia-muted)]">
          {result}
        </div>
      ) : null}
    </div>
  );
}
