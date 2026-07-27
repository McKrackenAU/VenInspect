"use client";

import { useEffect, useState, useTransition } from "react";
import { importAssetsFromFile } from "@/lib/actions";
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

  // Heal stale session role (DB Admin + cookie Inspector) before import.
  useEffect(() => {
    void fetch("/api/manage/session-sync", {
      method: "POST",
      credentials: "include",
    }).catch(() => {
      /* non-fatal */
    });
  }, []);

  return (
    <div className="space-y-4">
      <form
        className="space-y-4 rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setResult(null);
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            try {
              // Server action shares the Manage page cookie jar (avoids false
              // admin 403s from multipart fetch / stale session role).
              const res = await importAssetsFromFile(fd);
              if (!res.ok) {
                throw new Error(res.error);
              }
              setResult({
                created: res.created,
                updated: res.updated,
                skipped: res.skipped,
                total: res.total,
                errors: res.errors,
              });
            } catch (err) {
              if (
                typeof err === "object" &&
                err &&
                "digest" in err &&
                String((err as { digest?: string }).digest).startsWith(
                  "NEXT_REDIRECT",
                )
              ) {
                throw err;
              }
              const message =
                err instanceof Error ? err.message : "Import failed";
              // Next sometimes wraps action failures as this generic string
              if (
                message === "An unexpected response was received from the server."
              ) {
                setError(
                  "Import failed (session/upload). Sign out, sign back in, then try again — or use a smaller CSV.",
                );
              } else {
                setError(message);
              }
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

        <fieldset className="space-y-2 text-sm text-[color:var(--ventia-ink)]">
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
          className="btn-primary-inline w-full sm:w-auto"
        >
          {pending ? "Importing…" : "Import assets"}
        </button>

        {error ? (
          <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-100">
            {error}
          </p>
        ) : null}

        {result ? (
          <div className="rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--ventia-green-tint)] p-4 text-sm">
            <p className="font-medium text-[color:var(--ventia-green)]">
              Import complete
            </p>
            <ul className="mt-2 list-inside list-disc text-[color:var(--ventia-muted)]">
              <li>Parsed: {result.total}</li>
              <li>Created: {result.created}</li>
              <li>Updated: {result.updated}</li>
              <li>Skipped: {result.skipped}</li>
            </ul>
            {result.errors.length > 0 ? (
              <ul className="mt-3 max-h-40 overflow-auto text-xs text-amber-800 dark:text-amber-200">
                {result.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}
