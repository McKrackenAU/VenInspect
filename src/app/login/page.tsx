import { redirect } from "next/navigation";
import Link from "next/link";
import { loginAction } from "@/lib/auth-actions";
import { getSession } from "@/lib/auth";
import { getLoginMethodSettings } from "@/lib/auth-settings";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandMark } from "@/components/BrandMark";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

function errorMessage(code: string | undefined): string | null {
  switch (code) {
    case "1":
      return "Invalid username or password.";
    case "password_disabled":
      return "Username/password sign-in is turned off. Use Microsoft, or ask an admin to re-enable password login.";
    case "microsoft_off":
      return "Microsoft sign-in is not configured on this server yet (Entra app credentials).";
    case "microsoft_disabled":
      return "Microsoft sign-in is temporarily disabled by an admin. Use username/password, or ask an admin to turn it back on.";
    case "microsoft_user_disabled":
      return "Microsoft sign-in is not enabled for your account. Use username/password, or ask an admin.";
    case "microsoft_denied":
      return "Microsoft sign-in was cancelled.";
    case "microsoft_state":
      return "Microsoft sign-in expired — try again.";
    case "microsoft_unknown":
      return "No VenInspect account matches that Microsoft email. Ask an admin to create your user first (same work email).";
    case "microsoft_failed":
      return "Microsoft sign-in failed. Check Entra app settings and try again.";
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
  const methods = getLoginMethodSettings();
  const showPassword = methods.allowPassword;
  const showMicrosoft = methods.allowMicrosoft;
  const microsoftHref = `/api/auth/microsoft?next=${encodeURIComponent(next)}`;

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

        {error ? (
          <p
            className="mb-4 rounded-lg border border-rose-200 bg-[color:var(--danger-bg)] px-3 py-2 text-sm text-[color:var(--danger-fg)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {!showPassword && !showMicrosoft ? (
          <p className="text-sm text-[color:var(--ventia-muted)]">
            All login methods are disabled. Contact a system administrator.
          </p>
        ) : null}

        {showPassword ? (
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
        ) : null}

        {showPassword && showMicrosoft ? (
          <div className="my-5 flex items-center gap-3 text-xs font-medium text-[color:var(--ventia-muted)]">
            <span className="h-px flex-1 bg-[color:var(--ventia-border)]" />
            Or
            <span className="h-px flex-1 bg-[color:var(--ventia-border)]" />
          </div>
        ) : null}

        {showMicrosoft ? (
          <div className="space-y-2">
            <Link
              href={microsoftHref}
              className="flex min-h-[var(--touch)] w-full items-center justify-center gap-3 rounded-xl bg-[#2f2f2f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3a3a3a] dark:bg-[#1a1a1a] dark:hover:bg-[#252525]"
            >
              <MicrosoftIcon />
              Sign in with Microsoft
            </Link>
            {!methods.microsoftConfigured ? (
              <p className="text-center text-[10px] text-[color:var(--ventia-muted)]">
                Button shown — Entra credentials not set on this server yet
                (Admin → System).
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
