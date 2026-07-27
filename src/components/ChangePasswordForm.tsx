"use client";

import { useState, useTransition } from "react";
import { changePasswordAction } from "@/lib/auth-actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setDone(false);
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await changePasswordAction(fd);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setDone(true);
          e.currentTarget.reset();
        });
      }}
    >
      <div>
        <h2 className="text-base font-bold text-[color:var(--ventia-green)]">
          Change password
        </h2>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Enter your current password, then choose a new one (at least{" "}
          {MIN_PASSWORD_LENGTH} characters).
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Current password</span>
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          className="field-input"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">New password</span>
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          disabled={pending}
          className="field-input"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Confirm new password</span>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          disabled={pending}
          className="field-input"
        />
      </label>

      {error ? (
        <p
          className="rounded-lg border border-rose-200 bg-[color:var(--danger-bg)] px-3 py-2 text-sm text-[color:var(--danger-fg)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {done ? (
        <p
          className="rounded-lg border border-[color:var(--ventia-border)] bg-[color:var(--ventia-green-tint)] px-3 py-2 text-sm"
          role="status"
        >
          Password updated. Use the new password next time you sign in.
        </p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
