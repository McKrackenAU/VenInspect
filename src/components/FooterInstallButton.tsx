"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

/** Compact install control for the app footer. */
export function FooterInstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await deferred.prompt();
        await deferred.userChoice;
        setDeferred(null);
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--ventia-border)] bg-[color:var(--panel)] text-[color:var(--ventia-green)] transition hover:border-[color:var(--ventia-green)] hover:bg-[color:var(--ventia-green-tint)]"
      title="Install VenInspect"
      aria-label="Install VenInspect"
    >
      <InstallIcon />
    </button>
  );
}

function InstallIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5c.7 0 1.25.55 1.25 1.25v8.1l2.35-2.35a1.25 1.25 0 0 1 1.77 1.77l-4.5 4.5a1.25 1.25 0 0 1-1.77 0l-4.5-4.5a1.25 1.25 0 1 1 1.77-1.77l2.38 2.38V4.75c0-.7.55-1.25 1.25-1.25Z"
        fill="#8BC34A"
      />
      <path
        d="M5.5 17.25c0-.69.56-1.25 1.25-1.25h10.5c.69 0 1.25.56 1.25 1.25v.5A3.25 3.25 0 0 1 15.25 21h-6.5A3.25 3.25 0 0 1 5.5 17.75v-.5Z"
        fill="#2E7D32"
      />
    </svg>
  );
}
