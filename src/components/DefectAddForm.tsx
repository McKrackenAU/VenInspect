"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SeverityOption } from "@/lib/severities";

export type DefectComponentOption = {
  id: string;
  name: string;
  category?: string;
};

export function DefectAddForm({
  inspectionId,
  severities,
  components = [],
}: {
  inspectionId: string;
  severities: SeverityOption[];
  components?: DefectComponentOption[];
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [componentId, setComponentId] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const defaultSeverity =
    severities.find((s) => s.value === "CS2" || s.value === "MEDIUM")?.value ??
    severities[0]?.value ??
    "CS2";

  const selected = useMemo(
    () => components.find((c) => c.id === componentId),
    [components, componentId],
  );

  async function openExternalCamera() {
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
      setError(
        "Could not open a connected camera. Use gallery upload, or connect a GoPro in webcam mode (USB).",
      );
    }
  }

  function stopCamera() {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraOpen(false);
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
        const file = new File([blob], `gopro-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setPhotoFile(file);
        setPreview(URL.createObjectURL(blob));
        stopCamera();
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <form
      className="card space-y-4 border-dashed p-4"
      id="defect-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const form = e.currentTarget;
        const fd = new FormData(form);
        if (photoFile) {
          fd.set("photo", photoFile);
        }
        if (selected) {
          fd.set("componentId", selected.id);
          fd.set("category", selected.category || selected.name);
          fd.set("subcategory", selected.name);
        }
        try {
          const res = await fetch(`/api/inspections/${inspectionId}/defects`, {
            method: "POST",
            body: fd,
          });
          const body = (await res.json().catch(() => null)) as {
            error?: string;
            ok?: boolean;
          } | null;
          if (!res.ok) {
            throw new Error(
              body?.error ||
                (res.status === 413
                  ? "Photo too large for the server"
                  : `Save failed (${res.status})`),
            );
          }
          setPreview(null);
          setPhotoFile(null);
          form.reset();
          setComponentId("");
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save defect");
        } finally {
          setPending(false);
        }
      }}
    >
      <h3 className="text-base font-bold">Add a defect</h3>
      <p className="text-sm text-[color:var(--ventia-muted)]">
        Choose the component, take a photo, then describe it. Photos compress to ≤1
        MB with the taken date stamped.
      </p>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Component</span>
        <select
          required={components.length > 0}
          value={componentId}
          onChange={(e) => setComponentId(e.target.value)}
          className="field-input"
        >
          <option value="">
            {components.length ? "— Select component —" : "— No components on asset —"}
          </option>
          {components.map((c) => (
            <option key={c.id} value={c.id}>
              {c.category ? `${c.category} / ${c.name}` : c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-h-[8rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[color:var(--ventia-green)] bg-[color:var(--ventia-green-tint)] px-4 py-6 text-center">
        <span className="text-sm font-bold text-[color:var(--ventia-green)]">
          {preview ? "Change photo" : "Tap to take / choose photo"}
        </span>
        <span className="text-xs text-[color:var(--ventia-muted)]">
          Required · compressed ≤1 MB · date stamp
        </span>
        <input
          name="photo"
          type="file"
          accept="image/*,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          capture="environment"
          required={!photoFile}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setPhotoFile(f);
              setPreview(URL.createObjectURL(f));
            } else {
              setPhotoFile(null);
              setPreview(null);
            }
          }}
        />
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Preview" className="mt-2 max-h-40 rounded-lg object-contain" />
        )}
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-[color:var(--ventia-green)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ventia-green)]"
          onClick={() => void openExternalCamera()}
        >
          Use connected / GoPro camera
        </button>
        {cameraOpen ? (
          <>
            <button
              type="button"
              className="btn-primary text-xs"
              onClick={captureFrame}
            >
              Capture still
            </button>
            <button
              type="button"
              className="rounded-lg border px-3 py-1.5 text-xs"
              onClick={stopCamera}
            >
              Close camera
            </button>
          </>
        ) : null}
      </div>
      {cameraOpen ? (
        <video
          ref={videoRef}
          className="max-h-56 w-full rounded-lg bg-black object-contain"
          playsInline
          muted
        />
      ) : null}

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">What is wrong?</span>
        <input
          name="description"
          required
          placeholder="Short description"
          className="field-input"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Extra notes (optional)</span>
        <textarea name="comments" rows={2} className="field-input min-h-[4.5rem]" />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Condition state</span>
        <select name="severity" defaultValue={defaultSeverity} className="field-input">
          {severities.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
              {s.description ? ` — ${s.description}` : ""}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save defect"}
      </button>
    </form>
  );
}
