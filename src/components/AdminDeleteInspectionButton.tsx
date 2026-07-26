"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminDeleteInspectionAction } from "@/lib/actions";

export function AdminDeleteInspectionButton({
  inspectionId,
  titleLabel,
  status,
  next,
}: {
  inspectionId: string;
  titleLabel: string;
  status: string;
  next: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setPassword("");
    setConfirmText("");
    setError(null);
  }

  const canSubmit =
    password.length > 0 &&
    (confirmText === "DELETE" || confirmText === titleLabel);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-rose-400/60 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300"
      >
        Delete
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`del-insp-${inspectionId}`}
        >
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-5 shadow-xl">
            <div>
              <h3
                id={`del-insp-${inspectionId}`}
                className="text-lg font-semibold text-rose-700 dark:text-rose-300"
              >
                Move report to Trash
              </h3>
              <p className="mt-2 text-sm text-[color:var(--ventia-muted)]">
                This removes{" "}
                <span className="font-medium text-[color:var(--ventia-ink)]">
                  {titleLabel}
                </span>{" "}
                ({status}) from the live lists. It stays in Trash for 30 days and can
                be restored. Child reports (if any) are unlinked, not deleted.
              </p>
            </div>

            <label className="block space-y-1 text-sm">
              <span className="font-medium">
                Type <kbd className="font-mono text-xs">DELETE</kbd> or the full
                report title
              </span>
              <input
                className="field-input w-full"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium">Your admin password</span>
              <input
                type="password"
                className="field-input w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
                onClick={close}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || !canSubmit}
                className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const fd = new FormData();
                    fd.set("inspectionId", inspectionId);
                    fd.set("password", password);
                    fd.set("confirmText", confirmText);
                    fd.set("next", next);
                    try {
                      const result = await adminDeleteInspectionAction(fd);
                      close();
                      router.push(result.next);
                      router.refresh();
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Delete failed",
                      );
                    }
                  });
                }}
              >
                {pending ? "Deleting…" : "Move to Trash"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
