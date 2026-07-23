"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAssetComponentsAction } from "@/lib/actions";
import type { AssetComponent } from "@/lib/asset-profile";
import { parseComponentsCsv } from "@/lib/import-templates-client";
import {
  StyledFileInput,
  TemplateDownloadButtons,
} from "@/components/StyledFileInput";

function newId() {
  return `comp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function AssetComponentsEditor({
  assetId,
  initial,
}: {
  assetId: string;
  initial: AssetComponent[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<AssetComponent[]>(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function update(index: number, patch: Partial<AssetComponent>) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  async function importFile(file: File) {
    setMessage(null);
    try {
      const text = await file.text();
      const parsed = parseComponentsCsv(text);
      if (parsed.length === 0) {
        setMessage("No component rows found in file.");
        return;
      }
      setRows((current) => {
        const next = [...current];
        for (const row of parsed) {
          const existing = next.findIndex(
            (c) => c.name.toLowerCase() === row.name.toLowerCase(),
          );
          if (existing >= 0) {
            next[existing] = {
              ...next[existing],
              category: row.category ?? next[existing].category,
              qty: row.qty ?? next[existing].qty,
              unit: row.unit ?? next[existing].unit,
            };
          } else {
            next.push({
              id: newId(),
              name: row.name,
              category: row.category,
              qty: row.qty,
              unit: row.unit,
              sortOrder: next.length,
            });
          }
        }
        return next;
      });
      setMessage(`Imported ${parsed.length} row(s). Review and Save.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-[color:var(--ventia-border)] p-3">
        <p className="text-sm font-medium">Import components</p>
        <p className="text-xs text-[color:var(--ventia-muted)]">
          Download a template, fill name / category / qty / unit, then upload CSV.
        </p>
        <TemplateDownloadButtons kind="components" />
        <div className="pt-1">
          <StyledFileInput
            name="componentsImport"
            accept=".csv,text/csv"
            label="Upload components CSV"
            hint="CSV only — matching names update existing rows"
          />
        </div>
        <button
          type="button"
          className="rounded-lg border border-[color:var(--ventia-green)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ventia-green)]"
          onClick={() => {
            const input = document.querySelector<HTMLInputElement>(
              'input[name="componentsImport"]',
            );
            const file = input?.files?.[0];
            if (!file) {
              setMessage("Choose a CSV file first.");
              return;
            }
            void importFile(file);
          }}
        >
          Apply import to list
        </button>
      </div>

      <form
        className="space-y-4"
        action={() => {
          setMessage(null);
          startTransition(async () => {
            const formData = new FormData();
            formData.set("assetId", assetId);
            formData.set("componentsJson", JSON.stringify(rows));
            try {
              await saveAssetComponentsAction(formData);
              setMessage("Saved.");
              router.refresh();
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Save failed");
            }
          });
        }}
      >
        {rows.length === 0 ? (
          <p className="text-sm text-[color:var(--ventia-muted)]">
            No components have been registered.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row, index) => (
              <li
                key={row.id || index}
                className="grid gap-2 rounded-xl border border-[color:var(--ventia-border)] p-3 sm:grid-cols-[1.4fr_1fr_0.55fr_0.55fr_auto]"
              >
                <input
                  value={row.name}
                  onChange={(event) => update(index, { name: event.target.value })}
                  placeholder="Component name"
                  className="field-input"
                />
                <input
                  value={row.category ?? ""}
                  onChange={(event) =>
                    update(index, { category: event.target.value })
                  }
                  placeholder="Category"
                  className="field-input"
                />
                <input
                  value={row.qty ?? ""}
                  onChange={(event) => update(index, { qty: event.target.value })}
                  placeholder="Qty"
                  className="field-input"
                />
                <input
                  value={row.unit ?? ""}
                  onChange={(event) => update(index, { unit: event.target.value })}
                  placeholder="Unit"
                  className="field-input"
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
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
          onClick={() =>
            setRows((current) => [
              ...current,
              {
                id: newId(),
                name: "",
                category: "",
                qty: "",
                unit: "",
                sortOrder: current.length,
              },
            ])
          }
        >
          + Add component
        </button>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Saving…" : "Save components"}
          </button>
          {message ? (
            <span className="text-sm text-[color:var(--ventia-muted)]">
              {message}
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
