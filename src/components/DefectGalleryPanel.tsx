"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  GalleryFileButton,
} from "@/components/CameraCapture";
import { photoPublicUrl } from "@/lib/photo-url";

type Photo = {
  id: string;
  path: string;
  caption: string | null;
  kind: string;
  sortOrder: number;
};

type TaskType = { id: string; code: string; label: string };

export function DefectGalleryPanel({
  inspectionId,
  defect,
  taskTypes,
  editable,
}: {
  inspectionId: string;
  defect: {
    id: string;
    defectCode: string;
    description: string;
    photos: Photo[];
    taskTypeId: string | null;
  };
  taskTypes: TaskType[];
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [captions, setCaptions] = useState<Record<string, string>>(() =>
    Object.fromEntries(defect.photos.map((p) => [p.id, p.caption ?? ""])),
  );

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setPending(true);
    setError(null);
    try {
      const fd = new FormData();
      files.forEach((f, i) => fd.append(`photo${i}`, f));
      fd.set("captions", JSON.stringify(files.map(() => "")));
      const res = await fetch(
        `/api/inspections/${inspectionId}/defects/${defect.id}`,
        { method: "POST", body: fd },
      );
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error || "Upload failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPending(false);
    }
  }

  async function saveCaptions() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/inspections/${inspectionId}/defects/${defect.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            captions: Object.entries(captions).map(([id, caption]) => ({
              id,
              caption,
            })),
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Save failed");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  async function breakout() {
    if (!selected.length) return;
    if (
      !window.confirm(
        `Break out ${selected.length} photo(s) into separate defect(s)?`,
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/inspections/${inspectionId}/defects/${defect.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "breakout", photoIds: selected }),
        },
      );
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error || "Breakout failed");
      setSelected([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Breakout failed");
    } finally {
      setPending(false);
    }
  }

  async function setTask(taskTypeId: string) {
    setPending(true);
    try {
      await fetch(`/api/inspections/${inspectionId}/defects/${defect.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: { taskTypeId: taskTypeId || null },
        }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-dashed border-[color:var(--ventia-border)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ventia-muted)]">
          Defect photos ({defect.photos.length}/100)
        </p>
        {editable ? (
          <div className="flex flex-wrap gap-2">
            <GalleryFileButton
              multiple
              disabled={pending || defect.photos.length >= 100}
              label="Add gallery photos"
              onFile={(files) => void uploadFiles(files)}
            />
            {selected.length > 0 ? (
              <button
                type="button"
                disabled={pending}
                className="rounded-lg border border-amber-600 px-2 py-1 text-xs font-semibold text-amber-800"
                onClick={() => void breakout()}
              >
                Break out ({selected.length})
              </button>
            ) : null}
            <button
              type="button"
              disabled={pending}
              className="rounded-lg border px-2 py-1 text-xs"
              onClick={() => void saveCaptions()}
            >
              Save captions
            </button>
          </div>
        ) : null}
      </div>

      {taskTypes.length > 0 && editable ? (
        <label className="block text-xs">
          Allocate to task
          <select
            className="field-input mt-1 text-sm"
            disabled={pending}
            value={defect.taskTypeId ?? ""}
            onChange={(e) => void setTask(e.target.value)}
          >
            <option value="">— None —</option>
            {taskTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <ul className="grid gap-2 sm:grid-cols-2">
        {defect.photos.map((p) => (
          <li
            key={p.id}
            className="overflow-hidden rounded-lg border border-[color:var(--ventia-border)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPublicUrl(p.path)}
              alt={p.caption || defect.defectCode}
              className="aspect-video w-full object-cover"
            />
            <div className="space-y-1 p-2">
              {editable ? (
                <>
                  <label className="flex items-center gap-2 text-[10px]">
                    <input
                      type="checkbox"
                      checked={selected.includes(p.id)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked
                            ? [...prev, p.id]
                            : prev.filter((x) => x !== p.id),
                        )
                      }
                    />
                    Select for breakout
                  </label>
                  <input
                    className="field-input w-full text-xs"
                    placeholder="Comment for this photo"
                    value={captions[p.id] ?? ""}
                    onChange={(e) =>
                      setCaptions((c) => ({ ...c, [p.id]: e.target.value }))
                    }
                  />
                </>
              ) : (
                <p className="text-xs text-[color:var(--ventia-muted)]">
                  {p.caption || "—"}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

export function DefectReorderBar({
  inspectionId,
  defectIds,
}: {
  inspectionId: string;
  defectIds: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function renumber(ordered: string[]) {
    setPending(true);
    try {
      await fetch(`/api/inspections/${inspectionId}/defects/${ordered[0] ?? "x"}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "renumber",
          orderedDefectIds: ordered,
        }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (defectIds.length < 2) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-1.5 text-xs font-semibold"
        onClick={() => void renumber([...defectIds].reverse())}
      >
        Reverse defect numbers
      </button>
      <button
        type="button"
        disabled={pending}
        className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-1.5 text-xs font-semibold"
        onClick={() => void renumber(defectIds)}
      >
        Renumber D001… in current order
      </button>
    </div>
  );
}
