"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SeverityOption } from "@/lib/condition-state";
import { normalizeConditionState } from "@/lib/condition-state";
import { formatDotPhotoName } from "@/lib/dot-photo-register";
import {
  useExportDownload,
  type ExportPhotoItem,
} from "@/components/ExportConditionDialog";

type PhotoItem = ExportPhotoItem & {
  severity?: string | null;
  group?: "general" | "defect";
};

function dateLabelFromIso(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function ClientExportWizard({
  inspectionId,
  reportHref,
  titleLabel,
  conditionStates,
  defaultSelected,
}: {
  inspectionId: string;
  reportHref: string;
  titleLabel: string;
  conditionStates: SeverityOption[];
  defaultSelected: string[];
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photoOrder, setPhotoOrder] = useState<string[]>([]);
  const [assetNumber, setAssetNumber] = useState("");
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const { busy, error, setError, progress, downloadClientExportPack } =
    useExportDownload();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPhotos(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/inspections/${inspectionId}/export-photos`,
        );
        const body = (await res.json().catch(() => null)) as {
          photos?: PhotoItem[];
          order?: string[];
          assetNumber?: string;
          error?: string;
        } | null;
        if (!res.ok) throw new Error(body?.error || "Could not load photos");
        if (cancelled) return;
        const list = body?.photos ?? [];
        setPhotos(list);
        setAssetNumber(body?.assetNumber ?? "");
        setPhotoOrder(
          body?.order?.length ? body.order : list.map((p) => p.key),
        );
      } catch (e) {
        if (cancelled) return;
        setPhotos([]);
        setPhotoOrder([]);
        setError(e instanceof Error ? e.message : "Could not load photos");
      } finally {
        if (!cancelled) setLoadingPhotos(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inspectionId, setError]);

  const allCodes = useMemo(
    () => conditionStates.map((s) => s.value),
    [conditionStates],
  );

  const orderedPhotos = useMemo(() => {
    const wanted = new Set(selected.map(normalizeConditionState));
    const visible = photos.filter((p) => {
      if (p.group === "general" || p.severity == null || p.severity === "") {
        return true;
      }
      const norm = normalizeConditionState(p.severity);
      return wanted.has(norm) || wanted.has(p.severity.trim().toUpperCase());
    });
    const byKey = new Map(visible.map((p) => [p.key, p]));
    const order = photoOrder.filter((k) => byKey.has(k));
    const missing = visible
      .map((p) => p.key)
      .filter((k) => !order.includes(k));
    // Missing general photos stay at the top; missing defects at the end
    const missingGeneral = missing.filter(
      (k) => byKey.get(k)?.group === "general",
    );
    const missingDefect = missing.filter(
      (k) => byKey.get(k)?.group !== "general",
    );
    const keys = [...missingGeneral, ...order, ...missingDefect];
    const result: PhotoItem[] = [];
    for (const k of keys) {
      const p = byKey.get(k);
      if (!p) continue;
      const idx = photoOrder.indexOf(k);
      const registerNo = idx >= 0 ? idx + 1 : result.length + 1;
      const taken = p.takenAt ? new Date(p.takenAt) : new Date();
      const previewName = assetNumber
        ? formatDotPhotoName({
            assetNumber,
            takenAt: taken,
            sequence: registerNo,
          })
        : (p.previewName ?? "");
      result.push({
        ...p,
        registerNo,
        previewName,
        dateLabel: p.dateLabel || dateLabelFromIso(p.takenAt),
      });
    }
    return result;
  }, [photos, photoOrder, selected, assetNumber]);

  function movePhoto(index: number, dir: -1 | 1) {
    const keys = orderedPhotos.map((p) => p.key);
    const j = index + dir;
    if (j < 0 || j >= keys.length) return;
    const next = [...keys];
    const tmp = next[index]!;
    next[index] = next[j]!;
    next[j] = tmp;
    const hidden = photoOrder.filter((k) => !next.includes(k));
    setPhotoOrder([...next, ...hidden]);
  }

  async function runExport() {
    if (selected.length === 0) {
      setError("Select at least one condition state");
      return;
    }
    const orderForPack = orderedPhotos.map((p) => p.key);
    try {
      await fetch(`/api/inspections/${inspectionId}/export-photos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: photoOrder }),
      });
    } catch {
      /* still try export */
    }
    await downloadClientExportPack(inspectionId, "client-export.zip", {
      severities: selected,
      photoOrder: orderForPack,
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <p className="text-sm text-[color:var(--ventia-muted)]">
          <Link
            href={reportHref}
            className="font-semibold text-[color:var(--ventia-green)] hover:underline"
          >
            ← Back to report
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold text-[color:var(--ventia-green)]">
          Client Export
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          {titleLabel} — choose condition states, set photo order, then build the
          ZIP pack.
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <aside className="card w-full shrink-0 space-y-2 p-3 lg:sticky lg:top-4 lg:w-52">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--ventia-muted)]">
              Condition states
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-[11px] font-semibold text-[color:var(--ventia-blue)]"
                onClick={() => setSelected(allCodes)}
              >
                All
              </button>
              <button
                type="button"
                className="text-[11px] font-semibold text-[color:var(--ventia-blue)]"
                onClick={() => setSelected([])}
              >
                None
              </button>
            </div>
          </div>
          <ul className="space-y-0.5">
            {conditionStates.map((s) => (
              <li key={s.value}>
                <label
                  className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[color:var(--ventia-border)]/40"
                  title={s.description || s.label}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(s.value)}
                    onChange={() =>
                      setSelected((prev) =>
                        prev.includes(s.value)
                          ? prev.filter((c) => c !== s.value)
                          : [...prev, s.value],
                      )
                    }
                    className="accent-[color:var(--ventia-green)]"
                  />
                  <span className="truncate text-sm font-medium">{s.label}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-[11px] leading-snug text-[color:var(--ventia-muted)]">
            {selected.length} of {conditionStates.length} selected
          </p>
        </aside>

        <section className="card min-w-0 flex-1 space-y-3 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ventia-muted)]">
            Photo order in ZIP / index
          </h2>
          <p className="text-sm text-[color:var(--ventia-muted)]">
            Use ↑ ↓ to set the client pack sequence (register order). General /
            section photos from the report are listed first by default, then defect
            photos.
          </p>

          {loadingPhotos ? (
            <p className="text-sm text-[color:var(--ventia-muted)]">Loading photos…</p>
          ) : photos.length === 0 ? (
            <p className="text-sm text-[color:var(--ventia-muted)]">
              No photos on this inspection yet. Add defect photos on the inspection
              page, then return here to order them.
            </p>
          ) : orderedPhotos.length === 0 ? (
            <p className="text-sm text-[color:var(--ventia-muted)]">
              {photos.length} photo{photos.length === 1 ? "" : "s"} on this inspection,
              but none match the selected condition states. Tick more states (or
              All) to include them in the pack.
            </p>
          ) : (
            <ol className="space-y-2">
              {orderedPhotos.map((p, i) => {
                const prev = orderedPhotos[i - 1];
                const showGeneralHeading =
                  p.group === "general" && prev?.group !== "general";
                const showDefectHeading =
                  p.group !== "general" &&
                  (i === 0 || prev?.group === "general");
                return (
                  <li key={p.key} className="space-y-2">
                    {showGeneralHeading ? (
                      <p className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--ventia-muted)]">
                        General / section photos
                      </p>
                    ) : null}
                    {showDefectHeading ? (
                      <p className="pt-2 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--ventia-muted)]">
                        Defect photos
                      </p>
                    ) : null}
                    <div className="flex items-center gap-2 rounded-xl border border-[color:var(--ventia-border)] px-3 py-2.5 text-sm">
                      <span className="w-6 shrink-0 text-xs font-medium text-[color:var(--ventia-muted)]">
                        {p.registerNo ?? i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-[color:var(--ventia-ink)]">
                          {p.label}
                        </span>
                        {p.detail ? (
                          <span className="block truncate text-xs text-[color:var(--ventia-muted)]">
                            {p.detail}
                          </span>
                        ) : null}
                        <span className="mt-0.5 block font-mono text-[11px] text-[color:var(--ventia-muted)]">
                          {p.previewName ?? "—"}
                          {p.dateLabel ? ` · ${p.dateLabel}` : ""}
                        </span>
                      </span>
                      <button
                        type="button"
                        disabled={i === 0 || busy}
                        className="rounded-lg border border-[color:var(--ventia-border)] px-2.5 py-1.5 text-xs font-semibold disabled:opacity-30"
                        onClick={() => movePhoto(i, -1)}
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={i === orderedPhotos.length - 1 || busy}
                        className="rounded-lg border border-[color:var(--ventia-border)] px-2.5 py-1.5 text-xs font-semibold disabled:opacity-30"
                        onClick={() => movePhoto(i, 1)}
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href={reportHref}
          className="rounded-lg border border-[color:var(--ventia-border)] px-4 py-2.5 text-sm font-semibold"
        >
          Cancel
        </Link>
        <button
          type="button"
          disabled={busy || loadingPhotos || selected.length === 0}
          onClick={() => void runExport()}
          className="rounded-lg bg-[color:var(--ventia-green)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? progress || "Building pack…" : "Build Client Export"}
        </button>
      </div>
      {busy ? (
        <p className="text-right text-xs text-[color:var(--ventia-muted)]">
          {progress ||
            "Building on the server, then downloading in 10 MB chunks…"}
        </p>
      ) : null}
    </div>
  );
}
