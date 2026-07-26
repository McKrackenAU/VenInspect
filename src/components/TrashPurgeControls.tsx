"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  purgeTrashAction,
  purgeTrashItemAction,
} from "@/lib/trash";

export function TrashPurgeAllButtons() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(mode: "old" | "all") {
    setError(null);
    setMessage(null);
    if (!password) {
      setError("Enter your admin password to purge");
      return;
    }
    const label =
      mode === "all"
        ? "Permanently delete ALL reports in Trash, including their photos?"
        : "Permanently delete Trash items older than 30 days, including photos?";
    if (!window.confirm(label)) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.set("password", password);
      fd.set("mode", mode);
      try {
        const result = await purgeTrashAction(fd);
        setPassword("");
        setMessage(
          `Purged ${result.purged} report${result.purged === 1 ? "" : "s"} (${result.filesRemoved} files removed).`,
        );
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Purge failed");
      }
    });
  }

  return (
    <div className="space-y-2 rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ventia-muted)]">
        Permanent purge
      </p>
      <p className="text-sm text-[color:var(--ventia-muted)]">
        Removes database rows and deletes photo files from disk / TrueNAS. This cannot
        be undone.
      </p>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Admin password</span>
        <input
          type="password"
          className="field-input w-full max-w-xs"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          disabled={pending}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("old")}
          className="rounded-md border border-rose-600/70 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50 dark:text-rose-300"
        >
          Purge older than 30 days
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("all")}
          className="rounded-md bg-rose-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Purge all in Trash
        </button>
      </div>
      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-[color:var(--ventia-green)]" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function TrashPurgeItemButton({
  inspectionId,
  titleLabel,
}: {
  inspectionId: string;
  titleLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-rose-600/70 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300"
      >
        Purge now
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-5 shadow-xl">
            <div>
              <h3 className="text-lg font-semibold text-rose-700 dark:text-rose-300">
                Purge permanently
              </h3>
              <p className="mt-2 text-sm text-[color:var(--ventia-muted)]">
                Delete{" "}
                <span className="font-medium text-[color:var(--ventia-ink)]">
                  {titleLabel}
                </span>{" "}
                and all of its photos from disk. This cannot be undone.
              </p>
            </div>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Admin password</span>
              <input
                type="password"
                className="field-input w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
                disabled={pending}
                onClick={() => {
                  setOpen(false);
                  setPassword("");
                  setError(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || !password}
                className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const fd = new FormData();
                    fd.set("inspectionId", inspectionId);
                    fd.set("password", password);
                    try {
                      await purgeTrashItemAction(fd);
                      setOpen(false);
                      router.refresh();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Purge failed");
                    }
                  });
                }}
              >
                {pending ? "Purging…" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
