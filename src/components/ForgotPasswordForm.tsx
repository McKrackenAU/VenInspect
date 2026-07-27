"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { forgotPasswordAction } from "@/lib/auth-actions";

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        setDevUrl(null);
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          try {
            const res = await forgotPasswordAction(fd);
            setMessage(res.message);
            if (res.devResetUrl) setDevUrl(res.devResetUrl);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Request failed");
          }
        });
      }}
    >
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Username or email</span>
        <input
          name="login"
          type="text"
          required
          autoComplete="username"
          autoFocus
          disabled={pending}
          className="field-input"
        />
      </label>

      {error ? (
        <p className="text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          className="rounded-lg border border-[color:var(--ventia-border)] bg-[color:var(--ventia-green-tint)] px-3 py-2 text-sm"
          role="status"
        >
          {message}
        </p>
      ) : null}
      {devUrl ? (
        <p className="break-all text-xs text-[color:var(--ventia-muted)]">
          Dev only (mail not configured):{" "}
          <a className="text-[color:var(--ventia-blue)] underline" href={devUrl}>
            {devUrl}
          </a>
        </p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Sending…" : "Email reset link"}
      </button>

      <p className="text-center text-sm text-[color:var(--ventia-muted)]">
        <Link href="/login" className="font-semibold text-[color:var(--ventia-green)]">
          ← Back to sign in
        </Link>
      </p>
    </form>
  );
}
