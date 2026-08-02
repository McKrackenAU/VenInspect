"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { carryForwardDefect } from "@/lib/actions";
import type { SeverityOption } from "@/lib/severities";
import type { DefectComponentOption } from "@/components/DefectAddForm";
import { photoPublicUrl } from "@/lib/photo-url";

export type PriorDefect = {
  id: string;
  defectCode: string;
  description: string;
  comments: string | null;
  severity: string;
  photoPath: string | null;
  inspectionLabel: string;
  componentId?: string | null;
  category?: string | null;
  subcategory?: string | null;
};

export function CarryForwardDefects({
  inspectionId,
  priors,
  severities,
  components = [],
}: {
  inspectionId: string;
  priors: PriorDefect[];
  severities: SeverityOption[];
  components?: DefectComponentOption[];
}) {
  const router = useRouter();
  const [filterComponentId, setFilterComponentId] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!filterComponentId) return [];
    if (filterComponentId === "__ALL__") return priors;
    if (filterComponentId === "__UNCATEGORISED__") {
      return priors.filter((d) => !d.componentId && !d.subcategory && !d.category);
    }
    const comp = components.find((c) => c.id === filterComponentId);
    return priors.filter(
      (d) =>
        d.componentId === filterComponentId ||
        (comp &&
          (d.subcategory === comp.name ||
            d.category === comp.name ||
            d.category === comp.category)),
    );
  }, [priors, filterComponentId, components]);

  if (priors.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-[color:var(--ventia-green)]">
        Prior defects on this asset
      </h2>
      <p className="text-sm text-[color:var(--ventia-muted)]">
        Select a component to see matching history. Add to draft keeps the old photo
        as comparison; attach an updated condition photo and notes.
      </p>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Filter by component</span>
        <select
          className="field-input"
          value={filterComponentId}
          onChange={(e) => {
            setFilterComponentId(e.target.value);
            setOpenId(null);
          }}
        >
          <option value="">— Select component —</option>
          {components.map((c) => (
            <option key={c.id} value={c.id}>
              {c.category ? `${c.category} / ${c.name}` : c.name}
            </option>
          ))}
          <option value="__UNCATEGORISED__">Uncategorised</option>
          <option value="__ALL__">All components</option>
        </select>
      </label>

      {!filterComponentId ? (
        <p className="text-sm text-[color:var(--ventia-muted)]">
          Choose a component to list prior defects ({priors.length} on this asset).
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[color:var(--ventia-muted)]">
          No prior defects for this filter.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((d) => (
            <li key={d.id} className="card p-3">
              <div className="flex flex-wrap gap-3">
                {d.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoPublicUrl(d.photoPath)}
                    alt={d.defectCode}
                    className="h-16 w-20 rounded object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-semibold">{d.defectCode}</p>
                  <p className="text-sm">{d.description}</p>
                  <p className="text-xs text-[color:var(--ventia-muted)]">
                    {[d.category, d.subcategory].filter(Boolean).join(" / ") ||
                      "Uncategorised"}{" "}
                    · {d.inspectionLabel} · {d.severity}
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
                    <span className="font-medium">Updated condition / notes</span>
                    <textarea
                      name="comments"
                      rows={2}
                      defaultValue={d.comments ?? ""}
                      className="field-input"
                      placeholder="Current condition this visit…"
                    />
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">Condition state</span>
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
                      <span className="font-medium">Updated photo (recommended)</span>
                      <input
                        name="photo"
                        type="file"
                        accept="image/*"
                        capture="environment"
                      />
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
      )}
    </section>
  );
}
