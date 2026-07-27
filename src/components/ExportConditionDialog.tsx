"use client";

import { useEffect, useMemo, useState } from "react";
import type { SeverityOption } from "@/lib/condition-state";

export type ExportPhotoItem = {
  key: string;
  label: string;
  detail?: string;
  severity?: string | null;
  group?: "general" | "defect";
  takenAt?: string;
  registerNo?: number;
  previewName?: string;
  dateLabel?: string;
};

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
  photos,
  photoOrder,
  onPhotoOrderChange,
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
  photos?: ExportPhotoItem[];
  photoOrder?: string[];
  onPhotoOrderChange?: (next: string[]) => void;
}) {
  const allCodes = useMemo(() => states.map((s) => s.value), [states]);
  const orderedPhotos = useMemo(() => {
    if (!photos?.length) return [];
    const byKey = new Map(photos.map((p) => [p.key, p]));
    const order =
      photoOrder?.filter((k) => byKey.has(k)) ?? photos.map((p) => p.key);
    const missing = photos.map((p) => p.key).filter((k) => !order.includes(k));
    return [...order, ...missing]
      .map((k) => byKey.get(k))
      .filter((p): p is ExportPhotoItem => !!p);
  }, [photos, photoOrder]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  function movePhoto(index: number, dir: -1 | 1) {
    if (!onPhotoOrderChange) return;
    const keys = orderedPhotos.map((p) => p.key);
    const j = index + dir;
    if (j < 0 || j >= keys.length) return;
    const next = [...keys];
    const tmp = next[index]!;
    next[index] = next[j]!;
    next[j] = tmp;
    onPhotoOrderChange(next);
  }

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
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] shadow-xl">
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

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-3">
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
          </div>

          {orderedPhotos.length > 0 && onPhotoOrderChange ? (
            <div className="space-y-2 border-t border-[color:var(--ventia-border)] pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ventia-muted)]">
                Photo order in ZIP / index
              </p>
              <p className="text-xs text-[color:var(--ventia-muted)]">
                Use ↑ ↓ to set the client pack sequence (register order).
              </p>
              <ol className="space-y-1">
                {orderedPhotos.map((p, i) => (
                  <li
                    key={p.key}
                    className="flex items-center gap-2 rounded-lg border border-[color:var(--ventia-border)] px-2 py-1.5 text-sm"
                  >
                    <span className="w-6 shrink-0 text-xs text-[color:var(--ventia-muted)]">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{p.label}</span>
                      {p.detail ? (
                        <span className="block truncate text-xs text-[color:var(--ventia-muted)]">
                          {p.detail}
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      disabled={i === 0 || busy}
                      className="rounded border px-1.5 py-0.5 text-xs disabled:opacity-30"
                      onClick={() => movePhoto(i, -1)}
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={i === orderedPhotos.length - 1 || busy}
                      className="rounded border px-1.5 py-0.5 text-xs disabled:opacity-30"
                      onClick={() => movePhoto(i, 1)}
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

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

  async function downloadBlob(
    url: string,
    fallbackName: string,
    init?: RequestInit,
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { cache: "no-store", ...init });
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const isHtml = /^\s*</.test(text);
        const looksLikeCloudflare =
          isHtml &&
          /cloudflare|cf-ray|attention required|rate limited|just a moment/i.test(
            text,
          );
        if (looksLikeCloudflare || (isHtml && (res.status === 403 || res.status === 429 || res.status === 524))) {
          throw new Error(
            res.status === 429
              ? "Cloudflare rate-limited this download — wait a minute and try again."
              : "Cloudflare blocked this download (proxy/WAF). Try again, or use the LAN URL if this keeps happening.",
          );
        }
        try {
          const body = JSON.parse(text) as { error?: string };
          throw new Error(body?.error || `Export failed (${res.status})`);
        } catch (e) {
          if (e instanceof Error && e.message && !e.message.startsWith("Unexpected"))
            throw e;
          throw new Error(`Export failed (${res.status})`);
        }
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

  /**
   * Client export via background job + token download.
   * Fetches the ZIP as a blob (object URL) so Chrome does not report
   * "file wasn't available on site" from a bare &lt;a download&gt; navigation.
   */
  async function downloadClientExportPack(
    inspectionId: string,
    fallbackName: string,
    body?: { severities?: string[]; photoOrder?: string[] },
  ) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("inspectionId", inspectionId);
      if (body?.severities?.length) {
        fd.set("severities", body.severities.join(","));
      }
      if (body?.photoOrder?.length) {
        fd.set("photoOrder", body.photoOrder.join("|"));
      }

      let startRes = await fetch("/api/exports/start", {
        method: "POST",
        cache: "no-store",
        body: fd,
      });

      if (startRes.status === 404) {
        startRes = await fetch(
          `/api/inspections/${inspectionId}/client-export`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify(body ?? {}),
          },
        );
      }

      const startText = await startRes.text();
      const startIsHtml = /^\s*</.test(startText);
      if (!startRes.ok) {
        if (startIsHtml || /cloudflare|cf-ray|just a moment/i.test(startText)) {
          throw new Error(
            "Cloudflare blocked starting the export. Wait a minute and try again — or use the LAN address if you have one.",
          );
        }
        let errMsg = `Export failed (${startRes.status})`;
        try {
          const errBody = JSON.parse(startText) as { error?: string };
          if (errBody.error) errMsg = errBody.error;
        } catch {
          /* keep */
        }
        throw new Error(errMsg);
      }
      const started = JSON.parse(startText) as {
        jobId?: string;
        token?: string;
        error?: string;
        ready?: boolean;
        status?: string;
        filename?: string | null;
        downloadUrl?: string | null;
      };
      if (!started.jobId) {
        throw new Error(started.error || "Export did not return a job id");
      }

      const jobId = started.jobId;
      let token = started.token ?? "";
      let downloadUrl = started.downloadUrl ?? null;
      let filename = started.filename || fallbackName;

      if (!(started.ready || started.status === "ready") || !downloadUrl) {
        const deadline = Date.now() + 5 * 60 * 1000;
        for (;;) {
          if (Date.now() > deadline) {
            throw new Error("Export timed out — try again with fewer photos");
          }
          await new Promise((r) => setTimeout(r, 900));
          const statusRes = await fetch(
            `/api/exports/start?job=${encodeURIComponent(jobId)}`,
            { cache: "no-store" },
          );
          const statusText = await statusRes.text();
          if (!statusRes.ok && /^\s*</.test(statusText)) {
            const legacy = await fetch(
              `/api/inspections/${inspectionId}/client-export?job=${encodeURIComponent(jobId)}`,
              { cache: "no-store" },
            );
            const legacyText = await legacy.text();
            if (!legacy.ok && /^\s*</.test(legacyText)) {
              throw new Error(
                "Cloudflare blocked the export status check. Try again shortly.",
              );
            }
            const status = JSON.parse(legacyText) as {
              status?: string;
              ready?: boolean;
              filename?: string | null;
              error?: string | null;
              token?: string;
              downloadUrl?: string | null;
            };
            if (!legacy.ok) {
              throw new Error(
                status?.error || `Export failed (${legacy.status})`,
              );
            }
            if (status.status === "error") {
              throw new Error(status.error || "Export failed");
            }
            if (status.ready || status.status === "ready") {
              if (status.filename) filename = status.filename;
              if (status.token) token = status.token;
              downloadUrl =
                status.downloadUrl ||
                (token
                  ? `/api/exports/file/${jobId}?token=${encodeURIComponent(token)}&name=${encodeURIComponent(filename)}`
                  : null);
              break;
            }
            continue;
          }
          const status = JSON.parse(statusText) as {
            status?: string;
            ready?: boolean;
            filename?: string | null;
            error?: string | null;
            token?: string;
            downloadUrl?: string | null;
          };
          if (!statusRes.ok) {
            throw new Error(
              status?.error || `Export failed (${statusRes.status})`,
            );
          }
          if (status.status === "error") {
            throw new Error(status.error || "Export failed");
          }
          if (status.ready || status.status === "ready") {
            if (status.filename) filename = status.filename;
            if (status.token) token = status.token;
            downloadUrl =
              status.downloadUrl ||
              (token
                ? `/api/exports/file/${jobId}?token=${encodeURIComponent(token)}&name=${encodeURIComponent(filename)}`
                : null);
            break;
          }
        }
      }

      if (!downloadUrl) {
        throw new Error("Export ready but no download link was returned");
      }

      // Prefer blob download — avoids Chrome "file wasn't available on site"
      // from &lt;a download href="/api/..."&gt; when the response errors/aborts.
      const dlRes = await fetch(downloadUrl, {
        cache: "no-store",
        credentials: "omit",
      });
      const dlTextProbe = dlRes.headers.get("content-type") || "";
      if (!dlRes.ok) {
        const errText = await dlRes.text().catch(() => "");
        if (/^\s*</.test(errText) || /cloudflare|cf-ray/i.test(errText)) {
          throw new Error(
            "Cloudflare blocked the ZIP download. Try again shortly, or use the LAN URL.",
          );
        }
        let msg = `Download failed (${dlRes.status})`;
        try {
          const body = JSON.parse(errText) as { error?: string };
          if (body.error) msg = body.error;
        } catch {
          /* keep */
        }
        throw new Error(msg);
      }
      if (dlTextProbe.includes("text/html")) {
        throw new Error(
          "Cloudflare blocked the ZIP download. Try again shortly, or use the LAN URL.",
        );
      }
      const blob = await dlRes.blob();
      if (!blob.size) {
        throw new Error("Download was empty — try building the pack again");
      }
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename.endsWith(".zip") ? filename : `${filename}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke after the browser has started the download
      setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, setError, downloadBlob, downloadClientExportPack };
}
