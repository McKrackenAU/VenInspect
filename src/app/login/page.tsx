import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/lib/auth-actions";
import { getSession } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandMark } from "@/components/BrandMark";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ error?: string; next?: string; reset?: string }>;
};

function errorMessage(code: string | undefined): string | null {
  switch (code) {
    case "1":
      return "Invalid username or password.";
    default:
      return null;
  }
}

export default async function LoginPage({ searchParams }: Props) {
  const session = await getSession();
  const params = await searchParams;
  const next = params.next && params.next.startsWith("/") ? params.next : "/";

  if (session) {
    redirect(next === "/login" ? "/" : next);
  }

  const error = errorMessage(params.error);
  const resetOk = params.reset === "1";

  return (
    <div className="relative mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-1 py-8">
      <div className="absolute right-1 top-0">
        <ThemeToggle />
      </div>
      <div className="card rounded-2xl p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={56} priority />
          <h1 className="mt-3 text-xl font-bold tracking-tight text-[color:var(--ventia-green)]">
            VenInspect
          </h1>
          <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
            Sign in to continue
          </p>
        </div>

        {resetOk ? (
          <p
            className="mb-4 rounded-lg border border-[color:var(--ventia-border)] bg-[color:var(--ventia-green-tint)] px-3 py-2 text-sm"
            role="status"
          >
            Password updated. Sign in with your new password.
          </p>
        ) : null}

        {error ? (
          <p
            className="mb-4 rounded-lg border border-rose-200 bg-[color:var(--danger-bg)] px-3 py-2 text-sm text-[color:var(--danger-fg)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <form action={loginAction} className="space-y-4" autoComplete="off">
          <input type="hidden" name="next" value={next} />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[color:var(--ventia-ink)]">
              Username
            </span>
            <input
              name="login"
              type="text"
              autoComplete="username"
              autoFocus
              required
              className="field-input"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[color:var(--ventia-ink)]">
              Password
            </span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="field-input"
            />
          </label>
          <button type="submit" className="btn-primary">
            Sign in
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[color:var(--ventia-muted)]">
          <Link
            href="/forgot-password"
            className="font-semibold text-[color:var(--ventia-green)] hover:underline"
          >
            Forgot password?
          </Link>
        </p>
      </div>
    </div>
  );
}
