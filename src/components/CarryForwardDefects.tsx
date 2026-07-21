"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { carryForwardDefect } from "@/lib/actions";
import type { SeverityOption } from "@/lib/severities";

export type PriorDefect = {
  id: string;
  defectCode: string;
  description: string;
  comments: string | null;
  severity: string;
  photoPath: string | null;
  inspectionLabel: string;
};

function photoUrl(path: string) {
  return `/api/uploads/${path.split(/[/\\]/).map(encodeURIComponent).join("/")}`;
}

export function CarryForwardDefects({
  inspectionId,
  priors,
  severities,
}: {
  inspectionId: string;
  priors: PriorDefect[];
  severities: SeverityOption[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (priors.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-[color:var(--ventia-green)]">
        Prior defects on this asset
      </h2>
      <p className="text-sm text-[color:var(--ventia-muted)]">
        Add a previous finding into this draft. The old photo is kept as a comparison;
        optionally attach an updated condition photo.
      </p>
      <ul className="space-y-2">
        {priors.map((d) => (
          <li key={d.id} className="card p-3">
            <div className="flex flex-wrap gap-3">
              {d.photoPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl(d.photoPath)}
                  alt={d.defectCode}
                  className="h-16 w-20 rounded object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-semibold">{d.defectCode}</p>
                <p className="text-sm">{d.description}</p>
                <p className="text-xs text-[color:var(--ventia-muted)]">
                  {d.inspectionLabel} · {d.severity}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-[color:var(--ventia-green)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ventia-green)]"
                onClick={() => setOpenId(openId === d.id ? null : d.id)}
              >
                {openId === d.id ? "Cancel" : "Add to draft"}
              </button>
            </div>

            {openId === d.id ? (
              <form
                className="mt-3 space-y-3 border-t border-[color:var(--ventia-border)] pt-3"
                action={(fd) => {
                  setError(null);
                  startTransition(async () => {
                    try {
                      await carryForwardDefect(fd);
                      setOpenId(null);
                      router.refresh();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Failed");
                    }
                  });
                }}
              >
                <input type="hidden" name="inspectionId" value={inspectionId} />
                <input type="hidden" name="sourceDefectId" value={d.id} />
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Updated description</span>
                  <input
                    name="description"
                    defaultValue={d.description}
                    className="field-input"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Notes</span>
                  <textarea
                    name="comments"
                    rows={2}
                    defaultValue={d.comments ?? ""}
                    className="field-input"
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">Severity</span>
                    <select
                      name="severity"
                      defaultValue={d.severity}
                      className="field-input"
                    >
                      {severities.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">New photo (optional)</span>
                    <input name="photo" type="file" accept="image/*" capture="environment" />
                  </label>
                </div>
                {error ? (
                  <p className="text-sm text-rose-700">{error}</p>
                ) : null}
                <button
                  type="submit"
                  disabled={pending}
                  className="btn-primary text-sm"
                >
                  {pending ? "Adding…" : "Add with comparison photo"}
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
