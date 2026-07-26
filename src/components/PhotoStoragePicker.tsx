"use client";

import { useCallback, useEffect, useState } from "react";
import { savePhotoStoragePath } from "@/lib/actions";

type BrowseEntry = {
  name: string;
  path: string;
  writable: boolean;
};

type BrowsePayload = {
  ok: boolean;
  roots: string[];
  path: string;
  parent: string | null;
  entries: BrowseEntry[];
  writable: boolean;
  exists: boolean;
  suggestions?: { label: string; path: string }[];
  envLocked?: boolean;
  error?: string;
};

export function PhotoStoragePicker({
  currentPath,
  sourceLabel,
  envLocked,
  returnTo = "/manage/system",
  flashError = null,
  flashSaved = false,
}: {
  currentPath: string;
  sourceLabel: string;
  envLocked: boolean;
  returnTo?: string;
  flashError?: string | null;
  flashSaved?: boolean;
}) {
  const [value, setValue] = useState(currentPath);
  const [open, setOpen] = useState(false);
  const [browse, setBrowse] = useState<BrowsePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);

  const loadBrowse = useCallback(async (dir?: string) => {
    setLoading(true);
    setBrowseError(null);
    try {
      const qs = dir ? `?path=${encodeURIComponent(dir)}` : "";
      const res = await fetch(`/api/admin/storage-browse${qs}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as BrowsePayload;
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not list folders");
      }
      setBrowse(data);
    } catch (e) {
      setBrowseError(e instanceof Error ? e.message : "Could not list folders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setValue(currentPath);
  }, [currentPath]);

  useEffect(() => {
    if (!open) return;
    void loadBrowse(currentPath || undefined);
  }, [open, loadBrowse, currentPath]);

  function useFolder(p: string) {
    setValue(p);
    setOpen(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 space-y-1.5 text-sm">
          <span className="font-medium">Photo directory</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={envLocked}
            placeholder="/mnt/veninspect-photos"
            className="w-full rounded-md border border-[color:var(--ventia-border)] bg-transparent px-3 py-2 font-mono text-xs disabled:opacity-60"
          />
        </label>
        <button
          type="button"
          disabled={envLocked}
          onClick={() => setOpen(true)}
          className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Browse…
        </button>
      </div>

      <p className="text-xs text-[color:var(--ventia-muted)]">
        Active: <code className="font-mono">{currentPath}</code> · Source: {sourceLabel}
      </p>

      {flashSaved ? (
        <p className="text-sm font-medium text-[color:var(--ventia-green)]" role="status">
          Photo path saved.
        </p>
      ) : null}
      {flashError ? (
        <p className="text-sm text-rose-600" role="alert">
          {flashError}
        </p>
      ) : null}

      {envLocked ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Locked by <code>PHOTO_DIR</code> in <code>/etc/veninspect.env</code>. Edit that
          file on the LXC and restart the service, or remove it to manage the path here.
        </p>
      ) : (
        <form action={savePhotoStoragePath} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="photoDir" value={value} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button
            type="submit"
            className="rounded-md bg-[color:var(--ventia-green)] px-4 py-2 text-sm font-semibold text-white"
          >
            Save photo path
          </button>
          <button
            type="button"
            className="text-xs font-semibold text-[color:var(--ventia-blue)]"
            onClick={() => setValue("")}
          >
            Reset to default
          </button>
        </form>
      )}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Choose photo folder"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] shadow-xl">
            <div className="flex items-center justify-between gap-2 border-b border-[color:var(--ventia-border)] px-4 py-3">
              <h3 className="text-sm font-semibold">Choose photo folder</h3>
              <button
                type="button"
                className="text-sm font-semibold text-[color:var(--ventia-muted)]"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="space-y-2 border-b border-[color:var(--ventia-border)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--ventia-muted)]">
                Quick locations
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(browse?.suggestions ?? []).map((s) => (
                  <button
                    key={s.path}
                    type="button"
                    className="rounded-md border border-[color:var(--ventia-border)] px-2 py-1 text-[11px] font-medium hover:border-[color:var(--ventia-green)]"
                    onClick={() => void loadBrowse(s.path)}
                    title={s.path}
                  >
                    {s.label}
                  </button>
                ))}
                {(browse?.roots ?? []).map((r) => (
                  <button
                    key={`root-${r}`}
                    type="button"
                    className="rounded-md border border-[color:var(--ventia-border)] px-2 py-1 font-mono text-[11px] hover:border-[color:var(--ventia-green)]"
                    onClick={() => void loadBrowse(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 border-b border-[color:var(--ventia-border)] px-4 py-2 text-xs">
              <button
                type="button"
                disabled={!browse?.parent || loading}
                className="rounded border border-[color:var(--ventia-border)] px-2 py-1 font-semibold disabled:opacity-30"
                onClick={() => browse?.parent && void loadBrowse(browse.parent)}
              >
                Up
              </button>
              <code className="min-w-0 flex-1 truncate font-mono text-[11px]">
                {browse?.path ?? "…"}
              </code>
              {browse?.writable ? (
                <span className="shrink-0 text-[10px] font-semibold text-[color:var(--ventia-green)]">
                  writable
                </span>
              ) : (
                <span className="shrink-0 text-[10px] text-[color:var(--ventia-muted)]">
                  check perms
                </span>
              )}
            </div>

            {browseError ? (
              <p className="px-4 py-2 text-sm text-rose-600">{browseError}</p>
            ) : null}

            <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {loading ? (
                <li className="px-2 py-3 text-sm text-[color:var(--ventia-muted)]">
                  Loading…
                </li>
              ) : !browse?.entries.length ? (
                <li className="px-2 py-3 text-sm text-[color:var(--ventia-muted)]">
                  No subfolders here. You can still use this folder.
                </li>
              ) : (
                browse.entries.map((e) => (
                  <li key={e.path}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-[color:var(--ventia-border)]/40"
                      onClick={() => void loadBrowse(e.path)}
                    >
                      <span className="w-8 shrink-0 font-mono text-[10px] text-[color:var(--ventia-muted)]">
                        dir
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{e.name}</span>
                      {!e.writable ? (
                        <span className="text-[10px] text-[color:var(--ventia-muted)]">
                          locked
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>

            <div className="flex flex-wrap justify-end gap-2 border-t border-[color:var(--ventia-border)] px-4 py-3">
              <button
                type="button"
                className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm font-semibold"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!browse?.exists}
                className="rounded-md bg-[color:var(--ventia-green)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => browse?.path && useFolder(browse.path)}
              >
                Use this folder
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
