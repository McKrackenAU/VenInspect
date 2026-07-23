"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveExportConfigAction } from "@/lib/actions";
import type { ExportConfig } from "@/lib/export-config";
import type { SeverityOption } from "@/lib/severities";

export function ExportConfigForm({
  initial,
  conditionStates,
}: {
  initial: ExportConfig;
  conditionStates: SeverityOption[];
}) {
  const router = useRouter();
  const [cfg, setCfg] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function toggleState(code: string) {
    setCfg((prev) => {
      const set = new Set(prev.defaultConditionStates);
      if (set.has(code)) set.delete(code);
      else set.add(code);
      return { ...prev, defaultConditionStates: [...set] };
    });
  }

  return (
    <form
      className="space-y-5"
      action={() => {
        setMessage(null);
        startTransition(async () => {
          const fd = new FormData();
          fd.set("configJson", JSON.stringify(cfg));
          try {
            await saveExportConfigAction(fd);
            setMessage("Export configurator saved.");
            router.refresh();
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Save failed");
          }
        });
      }}
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Client Export pack contents</legend>
        {(
          [
            ["includePdf", "Include Report.pdf"],
            ["includePhotos", "Include Photos/ folders"],
            ["includePhotoIndex", "Include Photo_Index.xlsx"],
            ["includeComparisonPhotos", "Include comparison (prior) photos"],
            ["includeFormPhotos", "Include form / section photos in PDF & ZIP"],
            [
              "filterPdfByConditionStates",
              "Allow condition-state filter on PDF export",
            ],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(cfg[key])}
              onChange={(e) => setCfg((p) => ({ ...p, [key]: e.target.checked }))}
              className="accent-[color:var(--ventia-green)]"
            />
            {label}
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">
          Default condition states for exports
        </legend>
        <p className="text-xs text-[color:var(--ventia-muted)]">
          Inspectors can change these per export; this sets the starting selection for
          mass / client packs.
        </p>
        <ul className="space-y-2">
          {conditionStates.map((s) => (
            <li key={s.value}>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={cfg.defaultConditionStates.includes(s.value)}
                  onChange={() => toggleState(s.value)}
                  className="mt-1 accent-[color:var(--ventia-green)]"
                />
                <span>
                  <span className="font-medium">
                    {s.label} ({s.value})
                  </span>
                  {s.description ? (
                    <span className="block text-xs text-[color:var(--ventia-muted)]">
                      {s.description}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save export configurator"}
      </button>
      {message ? (
        <p className="text-sm text-[color:var(--ventia-muted)]">{message}</p>
      ) : null}
    </form>
  );
}
