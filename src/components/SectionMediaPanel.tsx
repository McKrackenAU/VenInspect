"use client";

import { useState } from "react";
import type { FormMediaItem } from "@/lib/inspection-template-types";
import {
  CameraCapturePanel,
  GalleryFileButton,
  PhoneCameraFileButton,
} from "@/components/CameraCapture";

function uploadUrl(path: string) {
  return `/api/uploads/${path
    .split(/[/\\]/)
    .map(encodeURIComponent)
    .join("/")}`;
}

export function SectionMediaPanel({
  inspectionId,
  sectionId,
  fieldId,
  label,
  items,
  editable,
  allowRaiseDefect,
  defectDefaults,
  onMediaChange,
}: {
  inspectionId: string;
  sectionId: string;
  fieldId?: string;
  label?: string;
  items: FormMediaItem[];
  editable: boolean;
  allowRaiseDefect?: boolean;
  defectDefaults?: {
    category?: string;
    subcategory?: string;
    description?: string;
    severity?: string;
  };
  onMediaChange: (items: FormMediaItem[]) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [raiseMediaId, setRaiseMediaId] = useState<string | null>(null);
  const [description, setDescription] = useState(
    defectDefaults?.description ?? "",
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function setPhoto(file: File) {
    setPendingFile(file);
    setPreview(URL.createObjectURL(file));
    setError(null);
  }

  function openRaise(mediaId?: string | null) {
    setRaiseMediaId(mediaId ?? null);
    setDescription(defectDefaults?.description ?? "");
    setRaiseOpen(true);
  }

  async function upload(file: File, asDefect: boolean) {
    setPending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("sectionId", sectionId);
      if (fieldId) fd.set("fieldId", fieldId);
      fd.set("photo", file);
      if (asDefect) {
        fd.set("raiseDefect", "1");
        fd.set("description", description.trim() || "Defect raised from form");
        fd.set("category", defectDefaults?.category ?? "General");
        fd.set("subcategory", defectDefaults?.subcategory ?? label ?? "Form");
        fd.set("severity", defectDefaults?.severity ?? "CS3");
      }
      const res = await fetch(`/api/inspections/${inspectionId}/form-media`, {
        method: "POST",
        body: fd,
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        media?: Record<string, FormMediaItem[]>;
        item?: FormMediaItem;
      } | null;
      if (!res.ok) throw new Error(body?.error || `Upload failed (${res.status})`);
      const key = fieldId ? `${sectionId}::${fieldId}` : sectionId;
      const next = body?.media?.[key] ?? [...items, ...(body?.item ? [body.item] : [])];
      onMediaChange(next);
      setPendingFile(null);
      setPreview(null);
      setRaiseOpen(false);
      setRaiseMediaId(null);
      setDescription(defectDefaults?.description ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPending(false);
    }
  }

  /** Raise a defect from an already-saved form photo (keeps Raise available after Save). */
  async function raiseFromExisting(mediaId: string) {
    setPending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("sectionId", sectionId);
      if (fieldId) fd.set("fieldId", fieldId);
      fd.set("mediaId", mediaId);
      fd.set("raiseDefect", "1");
      fd.set("description", description.trim() || "Defect raised from form");
      fd.set("category", defectDefaults?.category ?? "General");
      fd.set("subcategory", defectDefaults?.subcategory ?? label ?? "Form");
      fd.set("severity", defectDefaults?.severity ?? "CS3");
      const res = await fetch(`/api/inspections/${inspectionId}/form-media`, {
        method: "POST",
        body: fd,
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        media?: Record<string, FormMediaItem[]>;
      } | null;
      if (!res.ok) throw new Error(body?.error || `Raise failed (${res.status})`);
      const key = fieldId ? `${sectionId}::${fieldId}` : sectionId;
      if (body?.media?.[key]) onMediaChange(body.media[key]);
      setRaiseOpen(false);
      setRaiseMediaId(null);
      setDescription(defectDefaults?.description ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not raise defect");
    } finally {
      setPending(false);
    }
  }

  async function removeItem(mediaId: string) {
    if (!window.confirm("Remove this photo?")) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/inspections/${inspectionId}/form-media`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId, sectionId, fieldId }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        media?: Record<string, FormMediaItem[]>;
      } | null;
      if (!res.ok) throw new Error(body?.error || "Delete failed");
      const key = fieldId ? `${sectionId}::${fieldId}` : sectionId;
      onMediaChange(body?.media?.[key] ?? items.filter((m) => m.id !== mediaId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setPending(false);
    }
  }

  const raisePanel = raiseOpen ? (
    <div className="space-y-2 border-t border-[color:var(--ventia-border)] pt-2">
      <label className="block text-xs">
        Defect description
        <textarea
          className="field-input mt-1 min-h-[3rem] w-full"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue…"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !description.trim()}
          className="btn-primary text-xs"
          onClick={() => {
            if (raiseMediaId) void raiseFromExisting(raiseMediaId);
            else if (pendingFile) void upload(pendingFile, true);
          }}
        >
          {pending ? "Saving…" : "Create defect with photo"}
        </button>
        <button
          type="button"
          className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-1.5 text-xs"
          onClick={() => {
            setRaiseOpen(false);
            setRaiseMediaId(null);
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-[color:var(--ventia-border)] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ventia-muted)]">
        {label ? `${label} photos` : "Section photos"}
      </p>

      {items.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="relative overflow-hidden rounded-lg border border-[color:var(--ventia-border)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={uploadUrl(item.path)}
                alt={item.caption || "Form photo"}
                className="aspect-video w-full object-cover"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1 text-[10px] text-[color:var(--ventia-muted)]">
                <span>{item.defectId ? "Linked defect" : "Photo"}</span>
                {editable ? (
                  <span className="flex flex-wrap gap-2">
                    {allowRaiseDefect && !item.defectId ? (
                      <button
                        type="button"
                        disabled={pending}
                        className="font-semibold text-amber-700"
                        onClick={() => openRaise(item.id)}
                      >
                        Raise as defect
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={pending}
                      className="text-rose-600"
                      onClick={() => void removeItem(item.id)}
                    >
                      Remove
                    </button>
                  </span>
                ) : null}
              </div>
              {raiseOpen && raiseMediaId === item.id ? (
                <div className="px-2 pb-2">{raisePanel}</div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[color:var(--ventia-muted)]">No photos yet.</p>
      )}

      {editable ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <GalleryFileButton
              disabled={pending}
              label="Gallery"
              onFile={(files) => {
                const f = files[0];
                if (f) setPhoto(f);
              }}
            />
            <PhoneCameraFileButton
              disabled={pending}
              label="Phone camera"
              onFile={setPhoto}
            />
            <button
              type="button"
              disabled={pending}
              className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-1.5 text-xs disabled:opacity-50"
              onClick={() => setCameraOpen(true)}
            >
              Connected / GoPro
            </button>
          </div>

          <CameraCapturePanel
            open={cameraOpen}
            onClose={() => setCameraOpen(false)}
            onCapture={(file, url) => {
              setPendingFile(file);
              setPreview(url);
              setError(null);
            }}
          />

          {preview && pendingFile ? (
            <div className="space-y-2 rounded-lg border border-[color:var(--ventia-border)] p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Preview"
                className="max-h-40 rounded-lg object-contain"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className="btn-primary text-xs"
                  onClick={() => void upload(pendingFile, false)}
                >
                  {pending ? "Uploading…" : "Save photo"}
                </button>
                {allowRaiseDefect ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-lg border border-amber-500 px-3 py-1.5 text-xs font-semibold text-amber-700"
                    onClick={() => openRaise(null)}
                  >
                    Raise as defect…
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-1.5 text-xs"
                  onClick={() => {
                    setPendingFile(null);
                    setPreview(null);
                    setRaiseOpen(false);
                    setRaiseMediaId(null);
                  }}
                >
                  Discard
                </button>
              </div>
              {raiseOpen && !raiseMediaId ? raisePanel : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
