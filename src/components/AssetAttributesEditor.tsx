"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAssetProfileAction } from "@/lib/actions";
import { profileFieldLabel } from "@/lib/asset-profile";

export type AttributeRow = {
  id: string;
  value: string;
  autoPopulate: boolean;
};

const CORE_KEYS = [
  "__assetNumber",
  "__roadName",
  "__name",
  "__location",
  "__latitude",
  "__longitude",
  "__notes",
  "__seedClearancesFromPrior",
] as const;

export function AssetAttributesEditor({
  assetId,
  initialValues,
  initialAutoPopulate,
  coreDefaults,
}: {
  assetId: string;
  initialValues: Record<string, string>;
  initialAutoPopulate: Record<string, boolean>;
  /** Current registry column values shown for core flags */
  coreDefaults: Record<(typeof CORE_KEYS)[number], string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const initialRows = useMemo(() => {
    const ids = new Set<string>([
      ...Object.keys(initialValues),
      ...Object.keys(initialAutoPopulate),
      ...CORE_KEYS,
    ]);
    // Prefer inventory-ish keys first
    return [...ids]
      .filter((id) => !id.startsWith("raw:") || Boolean(initialValues[id]))
      .sort((a, b) => profileFieldLabel(a).localeCompare(profileFieldLabel(b)))
      .map(
        (id): AttributeRow => ({
          id,
          value:
            initialValues[id] ??
            (CORE_KEYS.includes(id as (typeof CORE_KEYS)[number])
              ? coreDefaults[id as (typeof CORE_KEYS)[number]]
              : ""),
          autoPopulate: Boolean(initialAutoPopulate[id]),
        }),
      );
  }, [initialValues, initialAutoPopulate, coreDefaults]);

  const [rows, setRows] = useState<AttributeRow[]>(initialRows);
  const [newId, setNewId] = useState("");
  const [newValue, setNewValue] = useState("");

  function update(i: number, patch: Partial<AttributeRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-[color:var(--ventia-green)]">
          Attributes & auto-populate
        </h2>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Tick Auto-fill reports next to each field to copy it into new inspections.
          Structure ID, road name, location and coordinates always seed from the registry.
          Use &quot;Auto-fill clearances from previous report&quot; to carry forward vertical
          clearance measurements.
        </p>
      </div>

      <ul className="space-y-2">
        {rows.map((row, i) => {
          const isCore = CORE_KEYS.includes(row.id as (typeof CORE_KEYS)[number]);
          return (
            <li
              key={row.id}
              className="grid gap-2 rounded-xl border border-[color:var(--ventia-border)] p-3 sm:grid-cols-[1fr_minmax(0,1.2fr)_auto]"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{profileFieldLabel(row.id)}</p>
                <p className="truncate font-mono text-[10px] text-[color:var(--ventia-muted)]">
                  {row.id}
                  {isCore ? " · registry" : ""}
                </p>
              </div>
              <input
                className="field-input text-sm"
                value={row.value}
                disabled={isCore}
                placeholder={isCore ? "Edit above in Save asset form" : "Value"}
                onChange={(e) => update(i, { value: e.target.value })}
              />
              <label className="inline-flex items-center gap-2 text-xs font-semibold sm:justify-end">
                <input
                  type="checkbox"
                  checked={row.autoPopulate}
                  onChange={(e) => update(i, { autoPopulate: e.target.checked })}
                  className="accent-[color:var(--ventia-green)]"
                />
                Auto-fill reports
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2 border-t border-[color:var(--ventia-border)] pt-3">
        <input
          className="field-input max-w-[12rem] font-mono text-sm"
          placeholder="field_id"
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
        />
        <input
          className="field-input min-w-[10rem] flex-1 text-sm"
          placeholder="Value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
        />
        <button
          type="button"
          className="rounded-lg border border-[color:var(--ventia-green)] px-3 py-2 text-xs font-semibold text-[color:var(--ventia-green)]"
          onClick={() => {
            const id = newId.trim().replace(/\s+/g, "_");
            if (!id) return;
            if (rows.some((r) => r.id === id)) return;
            setRows((prev) => [
              ...prev,
              { id, value: newValue, autoPopulate: true },
            ]);
            setNewId("");
            setNewValue("");
          }}
        >
          Add field
        </button>
      </div>

      <button
        type="button"
        className="btn-primary"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const values: Record<string, string> = {};
            const autoPopulate: Record<string, boolean> = {};
            for (const r of rows) {
              autoPopulate[r.id] = r.autoPopulate;
              if (!CORE_KEYS.includes(r.id as (typeof CORE_KEYS)[number])) {
                values[r.id] = r.value;
              }
            }
            const fd = new FormData();
            fd.set("assetId", assetId);
            fd.set("valuesJson", JSON.stringify(values));
            fd.set("autoPopulateJson", JSON.stringify(autoPopulate));
            try {
              await saveAssetProfileAction(fd);
              setMessage("Attributes saved.");
              router.refresh();
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Save failed");
            }
          });
        }}
      >
        {pending ? "Saving…" : "Save attributes & flags"}
      </button>
      {message ? (
        <p className="text-sm text-[color:var(--ventia-muted)]">{message}</p>
      ) : null}
    </div>
  );
}
