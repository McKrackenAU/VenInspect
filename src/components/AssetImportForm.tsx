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

const JSON_FALLBACK_MAX = 8 * 1024 * 1024; // 8 MB decoded

async function parseImportResponse(res: Response): Promise<{
  ok: boolean;
  status: number;
  body: (ImportOk | ImportErr) | null;
  text: string;
  isHtml: boolean;
}> {
  const text = await res.text();
  const isHtml = /^\s*</.test(text);
  let body: (ImportOk | ImportErr) | null = null;
  if (!isHtml && text) {
    try {
      body = JSON.parse(text) as ImportOk | ImportErr;
    } catch {
      body = null;
    }
  }
  return { ok: res.ok, status: res.status, body, text, isHtml };
}

function errorFromParsed(parsed: Awaited<ReturnType<typeof parseImportResponse>>) {
  const msg =
    (parsed.body && "error" in parsed.body && parsed.body.error) ||
    (!parsed.isHtml && parsed.text ? parsed.text.slice(0, 300) : null);
  if (msg) return msg;
  if (parsed.isHtml) {
    return `Upload blocked (HTTP ${parsed.status}) by the reverse proxy / Cloudflare (HTML page, not the app). Retrying with a different upload method…`;
  }
  return `Import failed (HTTP ${parsed.status})`;
}

/**
 * Prefer multipart (no custom headers — Cloudflare often blocks octet-stream).
 * On HTML 403/413, fall back to JSON+base64 for smaller files.
 */
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
        App {appVersion}
      </p>
      <form
        className="space-y-4 rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setResult(null);
          const form = e.currentTarget;
          const fdIn = new FormData(form);
          startTransition(async () => {
            try {
              const file = fdIn.get("file");
              const mode = String(fdIn.get("mode") ?? "upsert");
              if (!(file instanceof File) || file.size === 0) {
                throw new Error("Choose an Excel (.xlsx) or CSV file");
              }

              // 1) Standard multipart — no custom headers / query (WAF-friendly)
              const fd = new FormData();
              fd.set("file", file);
              fd.set("mode", mode);
              fd.set("importGrant", importGrant);

              let parsed = await parseImportResponse(
                await fetch("/api/manage/asset-import", {
                  method: "POST",
                  body: fd,
                  credentials: "include",
                  cache: "no-store",
                }),
              );

              // 2) HTML block (Cloudflare/nginx) → JSON base64 for smaller files
              if (
                !parsed.ok &&
                parsed.isHtml &&
                file.size <= JSON_FALLBACK_MAX
              ) {
                const bytes = new Uint8Array(await file.arrayBuffer());
                let binary = "";
                const chunk = 0x8000;
                for (let i = 0; i < bytes.length; i += chunk) {
                  binary += String.fromCharCode(
                    ...bytes.subarray(i, i + chunk),
                  );
                }
                const contentBase64 = btoa(binary);
                parsed = await parseImportResponse(
                  await fetch("/api/manage/asset-import", {
                    method: "POST",
                    credentials: "include",
                    cache: "no-store",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      grant: importGrant,
                      mode,
                      filename: file.name || "import.xlsx",
                      contentBase64,
                    }),
                  }),
                );
              }

              if (!parsed.ok) {
                if (parsed.isHtml) {
                  throw new Error(
                    `Upload blocked (HTTP ${parsed.status}) before it reached VenInspect — usually Cloudflare WAF or a reverse-proxy body limit. Try exporting a CSV under a few MB, or temporarily set the Cloudflare WAF for /api/manage/asset-import to allow. (App ${appVersion})`,
                  );
                }
                throw new Error(errorFromParsed(parsed));
              }

              if (!parsed.body || parsed.body.ok !== true) {
                throw new Error(
                  (parsed.body &&
                    "error" in parsed.body &&
                    parsed.body.error) ||
                    "Import failed — empty response from server.",
                );
              }

              setResult({
                created: parsed.body.created,
                updated: parsed.body.updated,
                skipped: parsed.body.skipped,
                total: parsed.body.total,
                errors: parsed.body.errors ?? [],
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
