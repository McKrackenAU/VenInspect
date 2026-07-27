"use client";

import { useState, useTransition } from "react";
import {
  StyledFileInput,
  TemplateDownloadButtons,
} from "@/components/StyledFileInput";

type ImportOk = {
  ok: true;
  created: number;
  updated: number;
  skipped: number;
  total: number;
  errors: string[];
};

type ImportErr = {
  ok?: false;
  error?: string;
};

export function AssetImportForm({ importTicket }: { importTicket: string }) {
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
                credentials: "include",
                cache: "no-store",
                headers: {
                  // Multipart uploads sometimes omit/lose cookies behind proxies.
                  // This ticket is minted on the Import page after requireAdmin().
                  "X-VenInspect-Import-Ticket": importTicket,
                },
              });

              const text = await res.text();
              let body: (ImportOk | ImportErr) | null = null;
              try {
                body = text ? (JSON.parse(text) as ImportOk | ImportErr) : null;
              } catch {
                body = null;
              }

              if (!res.ok) {
                const msg =
                  (body && "error" in body && body.error) ||
                  (text && !text.startsWith("<")
                    ? text.slice(0, 300)
                    : null);
                if (res.status === 401) {
                  throw new Error(
                    msg ||
                      "Not signed in. Refresh the Import page and try again.",
                  );
                }
                if (res.status === 403) {
                  throw new Error(
                    msg ||
                      "Admin access required. Refresh this Import page, then retry.",
                  );
                }
                throw new Error(msg || `Import failed (HTTP ${res.status})`);
              }

              if (!body || body.ok !== true) {
                throw new Error(
                  (body && "error" in body && body.error) ||
                    "Import failed — empty response from server.",
                );
              }

              setResult({
                created: body.created,
                updated: body.updated,
                skipped: body.skipped,
                total: body.total,
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
            hint="Bulk import is supported (hundreds of assets). Match the template headers."
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
