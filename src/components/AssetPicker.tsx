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
    if (!term) {
      // Prefer showing the preselected asset + a useful slice of the registry
      if (defaultAssetId) {
        const pre = assets.find((a) => a.id === defaultAssetId);
        const rest = assets.filter((a) => a.id !== defaultAssetId).slice(0, 80);
        return pre ? [pre, ...rest] : assets.slice(0, 80);
      }
      return assets.slice(0, 80);
    }
    return assets
      .filter(
        (a) =>
          a.assetNumber.toLowerCase().includes(term) ||
          a.name.toLowerCase().includes(term) ||
          a.roadName.toLowerCase().includes(term),
      )
      .slice(0, 100);
  }, [assets, q, defaultAssetId]);

  const selectedAsset = assets.find((a) => a.id === selected);

  if (assets.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        No assets in the registry yet. An admin must import or add assets under{" "}
        <strong>Admin → Assets</strong> before you can start an inspection.
        <input type="hidden" name={name} value="" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={selected} required />
      {!selected ? (
        <p className="text-xs text-rose-700" role="status">
          Select an asset below to continue.
        </p>
      ) : null}
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
        <ul className="max-h-72 overflow-auto rounded-xl border border-[color:var(--ventia-border)] bg-white">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-[color:var(--ventia-muted)]">
              No matches — try another road or code ({assets.length} in registry)
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
      {!selected && !q.trim() && assets.length > 80 ? (
        <p className="text-xs text-[color:var(--ventia-muted)]">
          Showing first 80 of {assets.length}. Type a road name or code to search all.
        </p>
      ) : null}
    </div>
  );
}
