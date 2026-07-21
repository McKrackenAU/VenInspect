"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSeverities } from "@/lib/actions";
import type { SeverityOption } from "@/lib/severities";

export function SeveritySettingsForm({ initial }: { initial: SeverityOption[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<SeverityOption[]>(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function update(i: number, patch: Partial<SeverityOption>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <form
      className="space-y-4"
      action={() => {
        setMessage(null);
        startTransition(async () => {
          const fd = new FormData();
          fd.set("severitiesJson", JSON.stringify(rows));
          try {
            await saveSeverities(fd);
            setMessage("Saved.");
            router.refresh();
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Save failed");
          }
        });
      }}
    >
      <ul className="space-y-2">
        {rows.map((row, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <input
              value={row.value}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder="VALUE"
              className="field-input max-w-[10rem] font-mono text-sm uppercase"
            />
            <input
              value={row.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Label shown in dropdown"
              className="field-input min-w-[12rem] flex-1"
            />
            <button
              type="button"
              className="rounded-lg border border-rose-300 px-2 py-1 text-xs text-rose-700"
              onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
        onClick={() => setRows((prev) => [...prev, { value: "", label: "" }])}
      >
        + Add severity
      </button>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save severities"}
        </button>
        {message ? (
          <span className="text-sm text-[color:var(--ventia-muted)]">{message}</span>
        ) : null}
      </div>
    </form>
  );
}
