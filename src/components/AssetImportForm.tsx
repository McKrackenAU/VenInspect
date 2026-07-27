"use client";

import { useState, useTransition } from "react";
import {
  StyledFileInput,
  TemplateDownloadButtons,
} from "@/components/StyledFileInput";

export function AssetImportForm() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    total: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <form
        className="space-y-4 rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setResult(null);
          const form = e.currentTarget;
          const fd = new FormData(form);
          startTransition(async () => {
            try {
              const res = await fetch("/api/manage/asset-import", {
                method: "POST",
                body: fd,
                credentials: "same-origin",
                // Let the browser set multipart boundary — do not set Content-Type
              });
              const text = await res.text();
              type ImportBody = {
                error?: string;
                created?: number;
                updated?: number;
                skipped?: number;
                total?: number;
                errors?: string[];
              };
              let body: ImportBody | null = null;
              try {
                body = text ? (JSON.parse(text) as ImportBody) : null;
              } catch {
                body = null;
              }
              const errMsg = body?.error;

              if (!res.ok) {
                if (res.status === 401) {
                  throw new Error(
                    errMsg ||
                      "Not signed in. Refresh the page and sign in again, then retry the import.",
                  );
                }
                if (res.status === 403) {
                  throw new Error(
                    errMsg ||
                      "Admin access required. Sign in with an admin account and retry.",
                  );
                }
                if (res.status === 413) {
                  throw new Error(
                    errMsg ||
                      "File too large for the server. Try CSV or a smaller workbook.",
                  );
                }
                throw new Error(
                  errMsg ||
                    (text && !text.startsWith("<")
                      ? text.slice(0, 200)
                      : `Import failed (${res.status})`),
                );
              }

              if (!body) {
                throw new Error("Unexpected response from server (not JSON).");
              }

              setResult({
                created: body.created ?? 0,
                updated: body.updated ?? 0,
                skipped: body.skipped ?? 0,
                total: body.total ?? 0,
                errors: body.errors ?? [],
              });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Import failed");
            }
          });
        }}
      >
        <div className="space-y-2">
          <p className="text-sm font-medium text-[color:var(--ventia-ink)]">
            Download a blank template first
          </p>
          <TemplateDownloadButtons kind="assets" />
        </div>

        <div className="space-y-1.5 text-sm">
          <span className="font-medium text-[color:var(--ventia-ink)]">
            Excel (.xlsx) or CSV
          </span>
          <StyledFileInput
            name="file"
            required
            accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            label="Choose import file"
            hint="Match the template column headers (includes AV ID, chainage from/to)"
          />
        </div>

        <fieldset className="space-y-2 text-sm">
          <legend className="font-medium">When Code already exists</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" value="upsert" defaultChecked />
            Update existing asset (match on Code / serial)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" value="skip" />
            Skip existing
          </label>
        </fieldset>

        <p className="text-xs text-[color:var(--ventia-muted)]">
          Template columns: Code, AV ID, Name, Road Name, Type, Sub Classification
          (e.g. PED_UNDERPASS), Location, Latitude, Longitude, Classification,
          Chainage From, Chainage To, Notes. Asset Vision exports still work
          (Asset ID → AV ID). Types inferred from name when Type is blank.
        </p>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[color:var(--ventia-green)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--ventia-green-mid)] disabled:opacity-60"
        >
          {pending ? "Importing…" : "Import assets"}
        </button>
      </form>

      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">
          {error}
        </p>
      )}

      {result && (
        <div className="rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-4 text-sm">
          <p className="font-medium text-[color:var(--ventia-green)]">Import complete</p>
          <ul className="mt-2 list-inside list-disc text-[color:var(--ventia-muted)]">
            <li>Parsed: {result.total}</li>
            <li>Created: {result.created}</li>
            <li>Updated: {result.updated}</li>
            <li>Skipped: {result.skipped}</li>
          </ul>
          {result.errors.length > 0 && (
            <ul className="mt-3 max-h-40 overflow-auto text-xs text-amber-800">
              {result.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
