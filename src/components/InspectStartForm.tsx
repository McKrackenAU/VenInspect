"use client";

import { useMemo, useState } from "react";
import { createInspection } from "@/lib/actions";
import { AssetPicker } from "@/components/AssetPicker";
import { ASSET_PERMIT_FLAGS, INSPECTION_TYPES } from "@/lib/inspection";

export type InspectAssetOption = {
  id: string;
  assetNumber: string;
  name: string;
  roadName: string;
  type: string;
  requireConfinedSpace: boolean;
  requireTrafficManagement: boolean;
  requireWorkingAtHeights: boolean;
};

type PermitAnswer = {
  willUse: boolean | null;
  reason: string;
};

export function InspectStartForm({
  assets,
  defaultAssetId,
}: {
  assets: InspectAssetOption[];
  defaultAssetId?: string;
}) {
  const [assetId, setAssetId] = useState(defaultAssetId ?? "");
  const [answers, setAnswers] = useState<Record<string, PermitAnswer>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selected = useMemo(
    () => assets.find((a) => a.id === assetId) ?? null,
    [assets, assetId],
  );

  const requiredPermits = useMemo(() => {
    if (!selected) return [];
    return ASSET_PERMIT_FLAGS.filter((f) => selected[f.assetField]);
  }, [selected]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!assetId) {
      setError("Select an asset to continue.");
      return;
    }

    for (const permit of requiredPermits) {
      const ans = answers[permit.key];
      if (!ans || ans.willUse === null) {
        setError(`Confirm whether you need: ${permit.label}`);
        return;
      }
      if (ans.willUse === false && !ans.reason.trim()) {
        setError(`Give a reason for not needing: ${permit.label}`);
        return;
      }
    }

    const fd = new FormData(e.currentTarget);
    fd.set("assetId", assetId);
    for (const permit of requiredPermits) {
      const ans = answers[permit.key]!;
      fd.set(`permit_${permit.key}_willUse`, ans.willUse ? "1" : "0");
      if (ans.willUse === false) {
        fd.set(`permit_${permit.key}_reason`, ans.reason.trim());
      }
    }

    setPending(true);
    try {
      await createInspection(fd);
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : "Could not start inspection");
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5 p-4 sm:p-5">
      <AssetPicker
        assets={assets}
        defaultAssetId={defaultAssetId}
        onAssetChange={(id) => {
          setAssetId(id);
          setAnswers({});
        }}
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Inspection type</legend>
        <p className="text-xs text-[color:var(--ventia-muted)]">
          Types are driven from a shared list so more inspection kinds can be added later.
        </p>
        {INSPECTION_TYPES.map((t, i) => (
          <label
            key={t.value}
            className="flex min-h-[3.25rem] cursor-pointer items-center gap-3 rounded-xl border border-[color:var(--ventia-border)] px-4 py-3 has-[:checked]:border-[color:var(--ventia-green)] has-[:checked]:bg-[color:var(--ventia-green-tint)]"
          >
            <input
              type="radio"
              name="level"
              value={t.value}
              defaultChecked={i === 0}
              className="h-5 w-5 accent-[color:var(--ventia-green)]"
            />
            <span>
              <span className="block font-semibold">{t.label}</span>
              <span className="text-xs text-[color:var(--ventia-muted)]">{t.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {requiredPermits.length > 0 ? (
        <fieldset className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-50/40 p-4 dark:bg-amber-950/20">
          <legend className="px-1 text-sm font-semibold text-amber-900 dark:text-amber-100">
            Site permits for this asset
          </legend>
          <p className="text-xs text-[color:var(--ventia-muted)]">
            This asset is flagged for the items below. Confirm each before starting. Answers are
            kept on the web report only (not in PDF export).
          </p>
          {requiredPermits.map((permit) => {
            const ans = answers[permit.key] ?? { willUse: null, reason: "" };
            return (
              <div
                key={permit.key}
                className="space-y-2 rounded-lg border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-3"
              >
                <p className="font-medium">{permit.label}</p>
                <p className="text-xs text-[color:var(--ventia-muted)]">{permit.hint}</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name={`ui_${permit.key}`}
                      checked={ans.willUse === true}
                      onChange={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [permit.key]: { willUse: true, reason: "" },
                        }))
                      }
                    />
                    Will use / obtain
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name={`ui_${permit.key}`}
                      checked={ans.willUse === false}
                      onChange={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [permit.key]: {
                            willUse: false,
                            reason: prev[permit.key]?.reason ?? "",
                          },
                        }))
                      }
                    />
                    Not needed this visit
                  </label>
                </div>
                {ans.willUse === false ? (
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">Reason (required)</span>
                    <textarea
                      rows={2}
                      value={ans.reason}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [permit.key]: {
                            willUse: false,
                            reason: e.target.value,
                          },
                        }))
                      }
                      placeholder="Why is this permit not required today?"
                      className="field-input w-full"
                    />
                  </label>
                ) : null}
              </div>
            );
          })}
        </fieldset>
      ) : null}

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Notes (optional)</span>
        <textarea
          name="generalComments"
          rows={3}
          placeholder="Weather, access, anything unusual…"
          className="field-input min-h-[6rem]"
        />
      </label>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Next"}
      </button>
    </form>
  );
}
