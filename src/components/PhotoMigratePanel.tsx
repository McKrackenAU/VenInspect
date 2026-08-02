"use client";

import { useEffect, useState } from "react";

type MigrateResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  remembered?: boolean;
  from?: string;
  to?: string;
  mode?: string;
  dryRun?: boolean;
  scanned?: number;
  copied?: number;
  skippedExisting?: number;
  moved?: number;
  errors?: number;
  bytesCopied?: number;
  samples?: string[];
  errorSamples?: string[];
  activePhotoDir?: string;
  previousPhotoDirs?: string[];
};

export function PhotoMigratePanel({
  activePhotoDir,
}: {
  activePhotoDir: string;
}) {
  const [from, setFrom] = useState("");
  const [mode, setMode] = useState<"copy" | "move">("copy");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MigrateResult | null>(null);
  const [previous, setPrevious] = useState<string[]>([]);

  useEffect(() => {
    void fetch("/api/manage/photo-migrate", { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json()) as MigrateResult;
        if (res.ok && body.previousPhotoDirs) {
          setPrevious(body.previousPhotoDirs);
        }
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  async function run(
    action: "remember" | "dryRun" | "migrate",
  ) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/manage/photo-migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          mode,
          dryRun: action === "dryRun",
          rememberOnly: action === "remember",
        }),
      });
      const body = (await res.json()) as MigrateResult;
      if (!res.ok) throw new Error(body.error || "Request failed");
      setResult(body);
      if (body.previousPhotoDirs) setPrevious(body.previousPhotoDirs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const mb =
    typeof result?.bytesCopied === "number"
      ? (result.bytesCopied / (1024 * 1024)).toFixed(1)
      : null;

  return (
    <section className="space-y-3 rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-5 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-[color:var(--ventia-green)]">
          Migrate photos from old location
        </h2>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Your active photo root is now the bind mount. If existing photos are
          still on the previous disk/path, point at that old folder and copy them
          here. Relative paths stay the same, so the database does not need
          rewriting.
        </p>
        <p className="mt-2 text-xs text-[color:var(--ventia-muted)]">
          Destination (active):{" "}
          <code className="font-mono">{activePhotoDir}</code>
        </p>
      </div>

      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Old photo folder</span>
        <input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="/var/lib/veninspect/photos"
          className="w-full rounded-md border border-[color:var(--ventia-border)] bg-transparent px-3 py-2 font-mono text-xs"
          disabled={busy}
        />
      </label>

      {previous.length ? (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--ventia-muted)]">
            Remembered old roots
          </p>
          <div className="flex flex-wrap gap-1.5">
            {previous.map((p) => (
              <button
                key={p}
                type="button"
                className="rounded-md border border-[color:var(--ventia-border)] px-2 py-1 font-mono text-[11px] hover:border-[color:var(--ventia-green)]"
                onClick={() => setFrom(p)}
                disabled={busy}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <fieldset className="space-y-2 text-sm">
        <legend className="font-medium">Mode</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="migrateMode"
            checked={mode === "copy"}
            onChange={() => setMode("copy")}
            disabled={busy}
            className="accent-[color:var(--ventia-green)]"
          />
          Copy (recommended — keeps the old copy until you confirm)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="migrateMode"
            checked={mode === "move"}
            onChange={() => setMode("move")}
            disabled={busy}
            className="accent-[color:var(--ventia-green)]"
          />
          Move (copy then delete from old folder)
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={busy || !from.trim()}
          onClick={() => void run("remember")}
        >
          Use as read fallback only
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy || !from.trim()}
          onClick={() => void run("dryRun")}
        >
          Dry run
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !from.trim()}
          onClick={() => void run("migrate")}
        >
          {busy
            ? "Working…"
            : mode === "move"
              ? "Move photos to bind mount"
              : "Copy photos to bind mount"}
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-2 text-sm">
          {result.message ? (
            <p className="font-medium text-[color:var(--ventia-green)]">
              {result.message}
            </p>
          ) : null}
          {typeof result.scanned === "number" ? (
            <p>
              {result.dryRun ? "Dry run — " : ""}
              Scanned <strong>{result.scanned}</strong>
              {" · "}copied/would-copy <strong>{result.copied ?? 0}</strong>
              {" · "}already present <strong>{result.skippedExisting ?? 0}</strong>
              {mode === "move" || result.moved ? (
                <>
                  {" · "}removed from source <strong>{result.moved ?? 0}</strong>
                </>
              ) : null}
              {" · "}errors <strong>{result.errors ?? 0}</strong>
              {mb ? <> · {mb} MB</> : null}
            </p>
          ) : null}
          {result.samples?.length ? (
            <ul className="max-h-40 overflow-auto rounded border border-[color:var(--ventia-border)] bg-[color:var(--ventia-green-tint)] p-2 text-xs font-mono">
              {result.samples.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : null}
          {result.errorSamples?.length ? (
            <ul className="max-h-32 overflow-auto rounded border border-rose-200 bg-rose-50 p-2 text-xs font-mono text-rose-800">
              {result.errorSamples.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
