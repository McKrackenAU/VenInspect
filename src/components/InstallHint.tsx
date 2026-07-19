"use client";

import { useEffect, useState } from "react";

/** Soft prompt to install PWA on mobile browsers that support it. */
export function InstallHint() {
  const [deferred, setDeferred] = useState<{ prompt: () => Promise<void> } | null>(
    null,
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("veninspect-install-dismissed") === "1") {
      setDismissed(true);
    }
    const handler = (e: Event) => {
      e.preventDefault();
      const ev = e as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: string }>;
      };
      setDeferred({
        prompt: async () => {
          await ev.prompt();
          await ev.userChoice;
          setDeferred(null);
        },
      });
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (dismissed || !deferred) return null;

  return (
    <div className="no-print card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <p className="text-sm">
        <strong>Add to home screen</strong> for one-tap field use (works like an app).
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-lg px-3 py-2 text-xs font-medium text-[color:var(--ventia-muted)]"
          onClick={() => {
            localStorage.setItem("veninspect-install-dismissed", "1");
            setDismissed(true);
          }}
        >
          Not now
        </button>
        <button
          type="button"
          className="rounded-lg bg-[color:var(--ventia-green)] px-3 py-2 text-xs font-semibold text-white"
          onClick={() => deferred.prompt()}
        >
          Install
        </button>
      </div>
    </div>
  );
}
