"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SeverityOption } from "@/lib/severities";
import {
  CameraCapturePanel,
  GalleryFileButton,
  PhoneCameraFileButton,
} from "@/components/CameraCapture";

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
  const [preview, setPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [componentId, setComponentId] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const defaultSeverity =
    severities.find((s) => s.value === "CS2" || s.value === "MEDIUM")?.value ??
    severities[0]?.value ??
    "CS2";

  const selected = useMemo(
    () => components.find((c) => c.id === componentId),
    [components, componentId],
  );

  function setPhoto(file: File) {
    setPhotoFile(file);
    setPreview(URL.createObjectURL(file));
    setError(null);
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
        } else {
          setError("Add a photo from Gallery, Phone camera, or connected GoPro.");
          setPending(false);
          return;
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
        Choose the component, add a photo, then describe it. Photos compress to ≤1
        MB with the taken date stamped. HEIC from iPhone Photos is not supported —
        use JPEG/PNG or take with the camera buttons.
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

      <div className="space-y-2 rounded-2xl border-2 border-dashed border-[color:var(--ventia-green)] bg-[color:var(--ventia-green-tint)] px-4 py-4">
        <p className="text-center text-sm font-bold text-[color:var(--ventia-green)]">
          {preview ? "Photo ready" : "Add photo"}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
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
            className="rounded-lg border border-[color:var(--ventia-border)] bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50 dark:bg-transparent"
            onClick={() => setCameraOpen(true)}
          >
            Connected / GoPro
          </button>
        </div>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Preview"
            className="mx-auto mt-2 max-h-40 rounded-lg object-contain"
          />
        ) : (
          <p className="text-center text-xs text-[color:var(--ventia-muted)]">
            Required · compressed ≤1 MB · date stamp
          </p>
        )}
      </div>

      <CameraCapturePanel
        open={cameraOpen}
        filePrefix="gopro"
        onClose={() => setCameraOpen(false)}
        onCapture={(file, url) => {
          setPhotoFile(file);
          setPreview(url);
          setError(null);
        }}
      />

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
            <option key={s.value} value={s.value} title={s.description || s.label}>
              {s.label}
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
