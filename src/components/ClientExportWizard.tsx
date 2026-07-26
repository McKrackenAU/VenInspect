"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { SeverityOption } from "@/lib/condition-state";
import { normalizeConditionState } from "@/lib/condition-state";
import {
  useExportDownload,
  type ExportPhotoItem,
} from "@/components/ExportConditionDialog";

type PhotoItem = ExportPhotoItem & {
  severity?: string | null;
  group?: "general" | "defect";
};

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
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const { busy, error, setError, downloadBlob } = useExportDownload();

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
          error?: string;
        } | null;
        if (!res.ok) throw new Error(body?.error || "Could not load photos");
        if (cancelled) return;
        const list = body?.photos ?? [];
        setPhotos(list);
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
    return [...missingGeneral, ...order, ...missingDefect]
      .map((k) => byKey.get(k))
      .filter((p): p is PhotoItem => !!p);
  }, [photos, photoOrder, selected]);

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
    const qs = new URLSearchParams({
      severities: selected.join(","),
    });
    if (orderForPack.length) qs.set("photoOrder", orderForPack.join("|"));
    await downloadBlob(
      `/api/inspections/${inspectionId}/client-export?${qs.toString()}`,
      "client-export.zip",
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
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

      <section className="card space-y-3 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ventia-muted)]">
          Condition states to include
        </h2>
        <ul className="space-y-2">
          {conditionStates.map((s) => (
            <li key={s.value}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[color:var(--ventia-border)] px-3 py-2.5 hover:border-[color:var(--ventia-green)]">
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
            onClick={() => setSelected(allCodes)}
          >
            All
          </button>
          <button
            type="button"
            className="text-xs font-semibold text-[color:var(--ventia-blue)]"
            onClick={() => setSelected([])}
          >
            None
          </button>
        </div>
      </section>

      <section className="card space-y-3 p-5">
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
            but none match the selected condition states. Tick more states above (or
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
                      {i + 1}
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
          {busy ? "Building pack…" : "Build Client Export"}
        </button>
      </div>
    </div>
  );
}
