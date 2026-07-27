"use client";

import { useState, useTransition } from "react";
import { importAssetsFromFile } from "@/lib/actions";
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
              // 1) Server action — same cookie jar as the Manage page (most reliable
              //    for admin session). 2) API fallback for large multipart quirks.
              let body: (ImportOk | ImportErr) | null = null;

              try {
                const actionRes = await importAssetsFromFile(fd);
                if (
                  actionRes &&
                  typeof actionRes === "object" &&
                  "ok" in actionRes
                ) {
                  body = actionRes as ImportOk | ImportErr;
                }
              } catch (actionErr) {
                if (
                  typeof actionErr === "object" &&
                  actionErr &&
                  "digest" in actionErr &&
                  String(
                    (actionErr as { digest?: string }).digest,
                  ).startsWith("NEXT_REDIRECT")
                ) {
                  throw actionErr;
                }
                // Fall through to API
                body = null;
              }

              if (!body) {
                const res = await fetch("/api/manage/asset-import", {
                  method: "POST",
                  body: fd,
                  credentials: "include",
                });
                const text = await res.text();
                try {
                  body = text ? (JSON.parse(text) as ImportOk | ImportErr) : null;
                } catch {
                  body = null;
                }
                if (!res.ok) {
                  const msg =
                    (body && "error" in body && body.error) ||
                    (text && !text.startsWith("<")
                      ? text.slice(0, 240)
                      : null);
                  if (res.status === 401) {
                    throw new Error(
                      msg ||
                        "Not signed in. Refresh and sign in again, then retry.",
                    );
                  }
                  if (res.status === 403) {
                    throw new Error(
                      msg ||
                        "Admin access required. Sign out and sign back in with your admin account.",
                    );
                  }
                  if (res.status === 413) {
                    throw new Error(
                      msg ||
                        "File too large for the server. Try CSV or a smaller workbook.",
                    );
                  }
                  throw new Error(msg || `Import failed (${res.status})`);
                }
              }

              if (!body || !("ok" in body)) {
                throw new Error("Import failed — empty response from server.");
              }
              if (body.ok !== true) {
                throw new Error(
                  ("error" in body && body.error) ||
                    "Admin access required. Sign out and sign back in with your admin account.",
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
          style={{ backgroundColor: "#004825", color: "#ffffff" }}
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
