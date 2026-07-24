"use client";

import { useState } from "react";

export function DotWorkbookImport({ assetId }: { assetId?: string }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <input
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={pending}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setPending(true);
          setResult(null);
          const fd = new FormData();
          fd.set("file", file);
          if (assetId) fd.set("assetId", assetId);
          void fetch("/api/manage/dot-import", { method: "POST", body: fd })
            .then(async (res) => {
              const body = (await res.json()) as {
                error?: string;
                sheetNames?: string[];
                referencesCount?: number;
              };
              if (!res.ok) throw new Error(body.error || "Import failed");
              setResult(
                `Parsed sheets: ${(body.sheetNames ?? []).join(", ")}. References: ${body.referencesCount ?? 0}`,
              );
            })
            .catch((err) =>
              setResult(err instanceof Error ? err.message : "Import failed"),
            )
            .finally(() => setPending(false));
        }}
      />
      {pending ? <p className="text-xs">Parsing…</p> : null}
      {result ? <p className="text-xs text-[color:var(--ventia-muted)]">{result}</p> : null}
    </div>
  );
}
