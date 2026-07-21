"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SeverityOption } from "@/lib/severities";

export function DefectAddForm({
  inspectionId,
  severities,
}: {
  inspectionId: string;
  severities: SeverityOption[];
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultSeverity =
    severities.find((s) => s.value === "MEDIUM")?.value ??
    severities[0]?.value ??
    "MEDIUM";

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
          form.reset();
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
        Take a photo first, then describe it. A code is created automatically.
      </p>

      <label className="flex min-h-[8rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[color:var(--ventia-green)] bg-[color:var(--ventia-green-tint)] px-4 py-6 text-center">
        <span className="text-sm font-bold text-[color:var(--ventia-green)]">
          {preview ? "Change photo" : "Tap to take / choose photo"}
        </span>
        <span className="text-xs text-[color:var(--ventia-muted)]">
          Required · saved compressed (JPEG preferred on iPhone)
        </span>
        <input
          name="photo"
          type="file"
          accept="image/*,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          capture="environment"
          required
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPreview(URL.createObjectURL(f));
            else setPreview(null);
          }}
        />
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Preview" className="mt-2 max-h-40 rounded-lg object-contain" />
        )}
      </label>

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

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">How serious?</span>
          <select name="severity" defaultValue={defaultSeverity} className="field-input">
            {severities.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Area (optional)</span>
          <input name="category" placeholder="e.g. Deck" className="field-input" />
        </label>
      </div>
      <input type="hidden" name="subcategory" value="" />

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
