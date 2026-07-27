"use client";

import { useState, useTransition } from "react";
import {
  StyledFileInput,
  TemplateDownloadButtons,
} from "@/components/StyledFileInput";
import { importAssetsFromFile } from "@/lib/actions";

export function AssetImportForm({
  importGrant,
  appVersion,
}: {
  importGrant: string;
  appVersion: string;
}) {
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
      <p className="text-xs text-[color:var(--ventia-muted)]">
        App {appVersion} · import grant {importGrant.slice(0, 8)}…
      </p>
      <form
        className="space-y-4 rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setResult(null);
          const form = e.currentTarget;
          const fd = new FormData(form);
          // Ensure grant is present even if the hidden input was stripped
          fd.set("importGrant", importGrant);
          startTransition(async () => {
            try {
              const outcome = await importAssetsFromFile(fd);
              if (!outcome.ok) {
                throw new Error(outcome.error);
              }
              setResult({
                created: outcome.created,
                updated: outcome.updated,
                skipped: outcome.skipped,
                total: outcome.total,
                errors: outcome.errors ?? [],
              });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Import failed");
            }
          });
        }}
      >
        <input type="hidden" name="importGrant" value={importGrant} />

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
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          />
        </div>

        <div className="space-y-1.5 text-sm">
          <span className="font-medium text-[color:var(--ventia-ink)]">
            When a code already exists
          </span>
          <select
            name="mode"
            defaultValue="upsert"
            className="w-full rounded-lg border border-[color:var(--ventia-border)] bg-[color:var(--panel)] px-3 py-2 text-[color:var(--ventia-ink)]"
          >
            <option value="upsert">Update existing rows</option>
            <option value="skip">Skip existing codes</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={pending || !importGrant}
          className="btn-primary-inline inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? "Importing…" : "Import assets"}
        </button>
      </form>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="rounded-lg border border-[color:var(--ventia-border)] bg-[color:var(--panel)] px-4 py-3 text-sm text-[color:var(--ventia-ink)]">
          <p className="font-medium">
            Imported {result.total} row{result.total === 1 ? "" : "s"}:{" "}
            {result.created} created, {result.updated} updated, {result.skipped}{" "}
            skipped.
          </p>
          {result.errors.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[color:var(--ventia-muted)]">
              {result.errors.slice(0, 20).map((line) => (
                <li key={line}>{line}</li>
              ))}
              {result.errors.length > 20 ? (
                <li>…and {result.errors.length - 20} more</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
