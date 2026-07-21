"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveInspectionTypesAction } from "@/lib/actions";
import type { InspectionTypeOption } from "@/lib/inspection-type-options";

export function InspectionTypesForm({ initial }: { initial: InspectionTypeOption[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<InspectionTypeOption[]>(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function update(i: number, patch: Partial<InspectionTypeOption>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <form
      className="space-y-4"
      action={() => {
        setMessage(null);
        startTransition(async () => {
          const fd = new FormData();
          fd.set("typesJson", JSON.stringify(rows));
          try {
            await saveInspectionTypesAction(fd);
            setMessage("Saved — Start inspection will show these types.");
            router.refresh();
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Save failed");
          }
        });
      }}
    >
      <ul className="space-y-3">
        {rows.map((row, i) => (
          <li
            key={i}
            className="space-y-2 rounded-xl border border-[color:var(--ventia-border)] p-3"
          >
            <div className="flex flex-wrap gap-2">
              <input
                value={row.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder="CODE"
                className="field-input max-w-[10rem] font-mono text-sm uppercase"
              />
              <input
                value={row.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Label"
                className="field-input min-w-[10rem] flex-1"
              />
              <button
                type="button"
                className="rounded-lg border border-rose-300 px-2 py-1 text-xs text-rose-700 dark:border-rose-800 dark:text-rose-300"
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
              >
                Remove
              </button>
            </div>
            <input
              value={row.description}
              onChange={(e) => update(i, { description: e.target.value })}
              placeholder="Short description shown to inspectors"
              className="field-input w-full text-sm"
            />
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(row.requiresLevel2Approval)}
                onChange={(e) =>
                  update(i, { requiresLevel2Approval: e.target.checked })
                }
                className="accent-[color:var(--ventia-green)]"
              />
              Needs Level 2 approval if inspector is not L2-qualified
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
        onClick={() =>
          setRows((prev) => [
            ...prev,
            { value: "", label: "", description: "", requiresLevel2Approval: false },
          ])
        }
      >
        + Add inspection type
      </button>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save inspection types"}
        </button>
        {message ? (
          <span className="text-sm text-[color:var(--ventia-muted)]">{message}</span>
        ) : null}
      </div>
    </form>
  );
}
