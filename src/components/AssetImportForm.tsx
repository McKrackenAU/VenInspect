"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
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

  const syncSession = useCallback(async () => {
    try {
      await fetch("/api/manage/session-sync", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } catch {
      /* non-fatal — ticket auth still works */
    }
  }, []);

  useEffect(() => {
    void syncSession();
  }, [syncSession]);

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
              await syncSession();

              const file = fd.get("file");
              const mode = String(fd.get("mode") ?? "upsert");
              if (!(file instanceof File) || file.size === 0) {
                throw new Error("Choose an Excel (.xlsx) or CSV file");
              }

              const params = new URLSearchParams({
                mode,
                filename: file.name || "import.xlsx",
                ticket: importTicket,
              });

              // Raw body + ticket query/header — avoids multipart Cookie loss
              // behind reverse proxies that broke admin auth on FormData posts.
              const res = await fetch(
                `/api/manage/asset-import?${params.toString()}`,
                {
                  method: "POST",
                  body: file,
                  credentials: "include",
                  cache: "no-store",
                  headers: {
                    // Always octet-stream so the API never tries multipart parse.
                    "Content-Type": "application/octet-stream",
                    "X-VenInspect-Import-Ticket": importTicket,
                  },
                },
              );

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
                      "Admin access required. Hard-refresh this Import page, then retry.",
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
          disabled={pending}
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
