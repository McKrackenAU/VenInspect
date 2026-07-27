import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto w-full max-w-lg space-y-5">
      <div>
        <p className="text-sm text-[color:var(--ventia-muted)]">
          <Link
            href="/"
            className="font-semibold text-[color:var(--ventia-green)] hover:underline"
          >
            ← Home
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold text-[color:var(--ventia-green)]">
          Account
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          {user.name}
          {user.username ? ` · @${user.username}` : ""} · {user.email}
        </p>
      </div>

      <ChangePasswordForm />

      <p className="text-xs text-[color:var(--ventia-muted)]">
        Forgotten your current password? Sign out and use{" "}
        <Link href="/forgot-password" className="font-semibold underline">
          Forgot password
        </Link>{" "}
        (email reset), or ask an administrator under Manage → Users.
      </p>
    </div>
  );
}
