"use client";

import { useRef, useState } from "react";
import type { FormMediaItem } from "@/lib/inspection-template-types";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [description, setDescription] = useState(
    defectDefaults?.description ?? "",
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function stopCamera() {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraOpen(false);
  }

  async function openCamera() {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      setStream(s);
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("Could not open camera. Use gallery upload instead.");
    }
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `capture-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setPendingFile(file);
        setPreview(URL.createObjectURL(blob));
        stopCamera();
      },
      "image/jpeg",
      0.92,
    );
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
      setDescription(defectDefaults?.description ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
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
              <div className="flex items-center justify-between gap-2 px-2 py-1 text-[10px] text-[color:var(--ventia-muted)]">
                <span>{item.defectId ? "Linked defect" : "Photo"}</span>
                {editable ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="text-rose-600"
                    onClick={() => void removeItem(item.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[color:var(--ventia-muted)]">No photos yet.</p>
      )}

      {editable ? (
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setPendingFile(file);
              setPreview(URL.createObjectURL(file));
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className="rounded-lg border border-[color:var(--ventia-green)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ventia-green)]"
              onClick={() => inputRef.current?.click()}
            >
              Add photo
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-1.5 text-xs"
              onClick={() => void openCamera()}
            >
              Use camera
            </button>
          </div>

          {cameraOpen ? (
            <div className="space-y-2">
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-video w-full rounded-lg bg-black object-cover"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-primary text-xs"
                  onClick={captureFrame}
                >
                  Capture
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-1.5 text-xs"
                  onClick={stopCamera}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

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
                    onClick={() => setRaiseOpen(true)}
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
                  }}
                >
                  Discard
                </button>
              </div>
              {raiseOpen ? (
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
                  <button
                    type="button"
                    disabled={pending || !description.trim()}
                    className="btn-primary text-xs"
                    onClick={() => void upload(pendingFile, true)}
                  >
                    {pending ? "Saving…" : "Create defect with photo"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
