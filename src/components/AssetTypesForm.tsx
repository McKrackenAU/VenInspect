"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAssetTypesAction } from "@/lib/actions";
import type { AssetTypeOption } from "@/lib/asset-types";

export function AssetTypesForm({ initial }: { initial: AssetTypeOption[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<AssetTypeOption[]>(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function update(index: number, patch: Partial<AssetTypeOption>) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  return (
    <form
      className="space-y-4"
      action={() => {
        setMessage(null);
        startTransition(async () => {
          const formData = new FormData();
          formData.set("typesJson", JSON.stringify(rows));
          try {
            await saveAssetTypesAction(formData);
            setMessage("Saved.");
            router.refresh();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Save failed");
          }
        });
      }}
    >
      <ul className="space-y-3">
        {rows.map((row, index) => (
          <li
            key={index}
            className="space-y-2 rounded-xl border border-[color:var(--ventia-border)] p-3"
          >
            <div className="flex flex-wrap gap-2">
              <input
                value={row.value}
                onChange={(event) => update(index, { value: event.target.value })}
                placeholder="CODE"
                className="field-input max-w-[10rem] font-mono text-sm uppercase"
              />
              <input
                value={row.label}
                onChange={(event) => update(index, { label: event.target.value })}
                placeholder="Label"
                className="field-input min-w-[10rem] flex-1"
              />
              <button
                type="button"
                className="rounded-lg border border-rose-300 px-2 py-1 text-xs text-rose-700 dark:border-rose-800 dark:text-rose-300"
                onClick={() =>
                  setRows((current) =>
                    current.filter((_, rowIndex) => rowIndex !== index),
                  )
                }
              >
                Remove
              </button>
            </div>
            <input
              value={row.description ?? ""}
              onChange={(event) =>
                update(index, { description: event.target.value })
              }
              placeholder="Short description"
              className="field-input w-full text-sm"
            />
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
        onClick={() =>
          setRows((current) => [
            ...current,
            { value: "", label: "", description: "" },
          ])
        }
      >
        + Add asset type
      </button>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save asset types"}
        </button>
        {message ? (
          <span className="text-sm text-[color:var(--ventia-muted)]">
            {message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
