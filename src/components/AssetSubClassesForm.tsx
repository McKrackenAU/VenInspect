"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAssetSubClassesAction } from "@/lib/actions";
import type { AssetSubClassOption } from "@/lib/asset-subclasses";
import type { AssetTypeOption } from "@/lib/asset-types";

export function AssetSubClassesForm({
  initial,
  assetTypes,
}: {
  initial: AssetSubClassOption[];
  assetTypes: AssetTypeOption[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<AssetSubClassOption[]>(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function update(index: number, patch: Partial<AssetSubClassOption>) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  function toggleForType(index: number, typeValue: string) {
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const existing = new Set(row.forTypes ?? []);
        if (existing.has(typeValue)) existing.delete(typeValue);
        else existing.add(typeValue);
        const forTypes = [...existing];
        return {
          ...row,
          forTypes: forTypes.length ? forTypes : undefined,
        };
      }),
    );
  }

  return (
    <form
      className="space-y-4"
      action={() => {
        setMessage(null);
        startTransition(async () => {
          const formData = new FormData();
          formData.set("subClassesJson", JSON.stringify(rows));
          try {
            await saveAssetSubClassesAction(formData);
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
                onChange={(event) =>
                  update(index, { value: event.target.value })
                }
                placeholder="CODE"
                className="field-input max-w-[12rem] font-mono text-sm uppercase"
              />
              <input
                value={row.label}
                onChange={(event) =>
                  update(index, { label: event.target.value })
                }
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
              placeholder="Short description (optional)"
              className="field-input w-full text-sm"
            />
            <fieldset className="space-y-1.5">
              <legend className="text-xs font-medium text-[color:var(--ventia-muted)]">
                Offer for asset types (none selected = all types)
              </legend>
              <div className="flex flex-wrap gap-2">
                {assetTypes.map((type) => {
                  const checked = (row.forTypes ?? []).includes(type.value);
                  return (
                    <label
                      key={type.value}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${
                        checked
                          ? "border-[color:var(--ventia-green)] bg-[color:var(--ventia-green-tint)] text-[color:var(--ventia-green)]"
                          : "border-[color:var(--ventia-border)] text-[color:var(--ventia-muted)]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleForType(index, type.value)}
                      />
                      {type.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
        onClick={() =>
          setRows((current) => [
            ...current,
            { value: "", label: "", description: "", forTypes: undefined },
          ])
        }
      >
        + Add subclass
      </button>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save subclasses"}
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
