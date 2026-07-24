"use client";

import { useState } from "react";
import type { SeverityOption } from "@/lib/severities";
import {
  ExportConditionDialog,
  useExportDownload,
  type ExportPhotoItem,
} from "@/components/ExportConditionDialog";

export function ClientExportButton({
  inspectionId,
  conditionStates,
  defaultSelected,
  className,
}: {
  inspectionId: string;
  conditionStates: SeverityOption[];
  defaultSelected: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [photos, setPhotos] = useState<ExportPhotoItem[]>([]);
  const [photoOrder, setPhotoOrder] = useState<string[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const { busy, error, setError, downloadBlob } = useExportDownload();

  async function openDialog() {
    setError(null);
    setSelected(defaultSelected);
    setOpen(true);
    setLoadingPhotos(true);
    try {
      const res = await fetch(
        `/api/inspections/${inspectionId}/export-photos`,
      );
      const body = (await res.json().catch(() => null)) as {
        photos?: ExportPhotoItem[];
        order?: string[];
        error?: string;
      } | null;
      if (!res.ok) throw new Error(body?.error || "Could not load photos");
      const list = body?.photos ?? [];
      setPhotos(list);
      setPhotoOrder(
        body?.order?.length ? body.order : list.map((p) => p.key),
      );
    } catch (e) {
      setPhotos([]);
      setPhotoOrder([]);
      setError(e instanceof Error ? e.message : "Could not load photos");
    } finally {
      setLoadingPhotos(false);
    }
  }

  async function runExport() {
    if (selected.length === 0) {
      setError("Select at least one condition state");
      return;
    }
    // Persist order then download
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
    if (photoOrder.length) qs.set("photoOrder", photoOrder.join("|"));
    const ok = await downloadBlob(
      `/api/inspections/${inspectionId}/client-export?${qs.toString()}`,
      "client-export.zip",
    );
    if (ok) setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => void openDialog()}
        className={
          className ??
          "rounded-md border border-[color:var(--ventia-green)] px-3 py-2 text-sm font-semibold text-[color:var(--ventia-green)] disabled:opacity-50"
        }
      >
        {busy && !open ? "Building pack…" : "Client Export"}
      </button>

      <ExportConditionDialog
        open={open}
        title="Client Export"
        description={
          loadingPhotos
            ? "Loading photos…"
            : "Builds a ZIP with the report PDF, photos, and index. Reorder photos for the client pack sequence."
        }
        states={conditionStates}
        selected={selected}
        onSelectedChange={setSelected}
        busy={busy || loadingPhotos}
        error={error}
        confirmLabel="Build Client Export"
        onConfirm={() => void runExport()}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        photos={photos}
        photoOrder={photoOrder}
        onPhotoOrderChange={setPhotoOrder}
      />
    </>
  );
}
