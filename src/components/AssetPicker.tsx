"use client";

import { useMemo, useState } from "react";

export type AssetOption = {
  id: string;
  assetNumber: string;
  name: string;
  roadName: string;
  type: string;
};

export function AssetPicker({
  assets,
  defaultAssetId,
  name = "assetId",
}: {
  assets: AssetOption[];
  defaultAssetId?: string;
  name?: string;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(defaultAssetId ?? "");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return assets.slice(0, 40);
    return assets
      .filter(
        (a) =>
          a.assetNumber.toLowerCase().includes(term) ||
          a.name.toLowerCase().includes(term) ||
          a.roadName.toLowerCase().includes(term),
      )
      .slice(0, 40);
  }, [assets, q]);

  const selectedAsset = assets.find((a) => a.id === selected);

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={selected} required />
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Search by road or code</span>
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="e.g. Kororoit or SN1234"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="field-input"
        />
      </label>

      {selectedAsset && (
        <div className="rounded-xl border-2 border-[color:var(--ventia-green)] bg-[color:var(--ventia-green-tint)] px-4 py-3">
          <p className="text-xs font-medium text-[color:var(--ventia-muted)]">Selected</p>
          <p className="font-semibold text-[color:var(--ventia-green)]">
            {selectedAsset.assetNumber}
          </p>
          <p className="text-sm">{selectedAsset.name}</p>
          <p className="text-xs text-[color:var(--ventia-muted)]">{selectedAsset.roadName}</p>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-[color:var(--ventia-blue)]"
            onClick={() => setSelected("")}
          >
            Change
          </button>
        </div>
      )}

      {!selected && (
        <ul className="max-h-64 overflow-auto rounded-xl border border-[color:var(--ventia-border)] bg-white">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-[color:var(--ventia-muted)]">
              No matches — try another road or code
            </li>
          ) : (
            filtered.map((a) => (
              <li key={a.id} className="border-b border-[color:var(--ventia-border)] last:border-0">
                <button
                  type="button"
                  onClick={() => setSelected(a.id)}
                  className="flex min-h-[3.25rem] w-full flex-col items-start px-4 py-3 text-left active:bg-[color:var(--ventia-green-tint)]"
                >
                  <span className="font-mono font-semibold text-[color:var(--ventia-green)]">
                    {a.assetNumber}
                  </span>
                  <span className="text-sm">{a.name}</span>
                  <span className="text-xs text-[color:var(--ventia-muted)]">{a.roadName}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
