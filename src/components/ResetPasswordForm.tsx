"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resetPasswordAction } from "@/lib/auth-actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <p className="text-sm text-rose-700">
        This reset link is incomplete.{" "}
        <Link href="/forgot-password" className="font-semibold underline">
          Request a new one
        </Link>
        .
      </p>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        fd.set("token", token);
        startTransition(async () => {
          const res = await resetPasswordAction(fd);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          router.push("/login?reset=1");
        });
      }}
    >
      <input type="hidden" name="token" value={token} />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">New password</span>
        <input
          name="newPassword"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          disabled={pending}
          className="field-input"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Confirm new password</span>
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          disabled={pending}
          className="field-input"
        />
      </label>

      {error ? (
        <p className="text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
