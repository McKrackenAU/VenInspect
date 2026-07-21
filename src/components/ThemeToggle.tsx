"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "veninspect-theme";

export type ThemeMode = "light" | "dark";

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.style.colorScheme = mode;
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const preferred =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setMode(preferred);
    applyTheme(preferred);
    setReady(true);
  }, []);

  function toggle() {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    setMode(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  if (!ready) {
    return (
      <button
        type="button"
        className="rounded-lg border border-[color:var(--ventia-border)] px-2.5 py-1.5 text-xs text-[color:var(--ventia-muted)]"
        aria-label="Theme"
      >
        …
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-lg border border-[color:var(--ventia-border)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--ventia-muted)] hover:bg-[color:var(--ventia-green-tint)]"
      aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={mode === "dark" ? "Light mode" : "Dark mode"}
    >
      {mode === "dark" ? "Light" : "Dark"}
    </button>
  );
}

/** Inline before paint — include in layout <head> via script. */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}else{document.documentElement.style.colorScheme='light';}}catch(e){}})();`;
