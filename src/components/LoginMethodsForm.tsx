"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveLoginMethodSettingsAction } from "@/lib/actions";

export function LoginMethodsForm({
  allowPassword,
  allowMicrosoft,
  microsoftConfigured,
}: {
  allowPassword: boolean;
  allowMicrosoft: boolean;
  microsoftConfigured: boolean;
}) {
  const router = useRouter();
  const [passwordOn, setPasswordOn] = useState(allowPassword);
  const [microsoftOn, setMicrosoftOn] = useState(allowMicrosoft);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        const fd = new FormData();
        if (passwordOn) fd.set("allowPassword", "1");
        if (microsoftOn) fd.set("allowMicrosoft", "1");
        startTransition(async () => {
          try {
            await saveLoginMethodSettingsAction(fd);
            setMessage("Saved — login page updated.");
            router.refresh();
          } catch (err) {
            setMessage(err instanceof Error ? err.message : "Save failed");
          }
        });
      }}
    >
      <p className="text-sm text-[color:var(--ventia-muted)]">
        Site-wide switches for the login page. Turn Microsoft off temporarily if
        Entra is down — password login stays available (for accounts that allow
        it). Per-user overrides are under People.
      </p>

      <label className="flex items-start gap-3 rounded-xl border border-[color:var(--ventia-border)] p-3 text-sm">
        <input
          type="checkbox"
          checked={passwordOn}
          onChange={(e) => setPasswordOn(e.target.checked)}
          className="mt-1 accent-[color:var(--ventia-green)]"
        />
        <span>
          <span className="font-semibold">Username / password</span>
          <span className="mt-0.5 block text-xs text-[color:var(--ventia-muted)]">
            Classic VenInspect login form
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-[color:var(--ventia-border)] p-3 text-sm">
        <input
          type="checkbox"
          checked={microsoftOn}
          onChange={(e) => setMicrosoftOn(e.target.checked)}
          className="mt-1 accent-[color:var(--ventia-green)]"
        />
        <span>
          <span className="font-semibold">Microsoft account</span>
          <span className="mt-0.5 block text-xs text-[color:var(--ventia-muted)]">
            Show “Sign in with Microsoft” on the login page
            {microsoftConfigured
              ? " · Entra credentials configured"
              : " · Entra env vars not set yet (button still shown for trial layout)"}
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[color:var(--ventia-green)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save login methods"}
        </button>
        {message ? (
          <span className="text-sm text-[color:var(--ventia-muted)]">{message}</span>
        ) : null}
      </div>
    </form>
  );
}
