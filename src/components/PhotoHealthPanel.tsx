"use client";

import { useState } from "react";

type Summary = {
  checked: number;
  ok: number;
  missing: number;
  healed: number;
  roots: string[];
  samples: { path: string; status: "ok" | "missing" | "healed" }[];
  writeProbe?: { photoDir: string; ok: boolean; error: string | null };
};

export function PhotoHealthPanel() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  async function run(heal: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        heal ? "/api/manage/photo-health" : "/api/manage/photo-health?heal=0",
        {
          method: heal ? "POST" : "GET",
          headers: heal ? { "Content-Type": "application/json" } : undefined,
          body: heal ? JSON.stringify({ limit: 1000 }) : undefined,
          cache: "no-store",
        },
      );
      const body = (await res.json()) as Summary & { error?: string };
      if (!res.ok) throw new Error(body.error || "Scan failed");
      setSummary(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-5 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-[color:var(--ventia-green)]">
          Photo link health
        </h2>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Checks whether stored photo paths still resolve on disk (current photo
          root, legacy <code>uploads/</code>, and common mounts). Heal re-links
          the defect thumbnail column from gallery rows when the file is still
          found.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => void run(false)}
        >
          {busy ? "Scanning…" : "Scan only"}
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => void run(true)}
        >
          {busy ? "Repairing…" : "Scan & repair links"}
        </button>
      </div>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {summary ? (
        <div className="space-y-2 text-sm">
          {summary.writeProbe ? (
            <p
              className={
                summary.writeProbe.ok
                  ? "text-[color:var(--ventia-green)]"
                  : "text-red-700"
              }
            >
              {summary.writeProbe.ok
                ? `Write OK — ${summary.writeProbe.photoDir}`
                : summary.writeProbe.error || "Photo storage not writable"}
            </p>
          ) : null}
          <p>
            Checked <strong>{summary.checked}</strong> · OK{" "}
            <strong>{summary.ok}</strong> · Missing{" "}
            <strong>{summary.missing}</strong> · Healed{" "}
            <strong>{summary.healed}</strong>
          </p>
          <p className="text-xs text-[color:var(--ventia-muted)]">
            Roots: {summary.roots.join(" · ")}
          </p>
          {summary.samples.length ? (
            <ul className="max-h-48 overflow-auto rounded border border-[color:var(--ventia-border)] bg-[color:var(--ventia-green-tint)] p-2 text-xs font-mono">
              {summary.samples.map((s, i) => (
                <li key={`${s.path}-${i}`}>
                  [{s.status}] {s.path}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
