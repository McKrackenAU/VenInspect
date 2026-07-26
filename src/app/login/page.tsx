import { redirect } from "next/navigation";
import Link from "next/link";
import { loginAction } from "@/lib/auth-actions";
import { getSession } from "@/lib/auth";
import { isMicrosoftAuthEnabled } from "@/lib/microsoft-auth";
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
    case "microsoft_off":
      return "Microsoft sign-in is not configured on this server.";
    case "microsoft_denied":
      return "Microsoft sign-in was cancelled.";
    case "microsoft_state":
      return "Microsoft sign-in expired — try again.";
    case "microsoft_unknown":
      return "No VenInspect account matches that Microsoft email. Ask an admin to create your user first (same work email), or enable auto-provision.";
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
  const microsoftOn = isMicrosoftAuthEnabled();
  const microsoftHref = `/api/auth/microsoft?next=${encodeURIComponent(next)}`;

  return (
    <div className="relative mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-1 py-8">
      <div className="absolute right-1 top-0">
        <ThemeToggle />
      </div>
      <div className="card rounded-2xl p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <BrandMark size={48} priority />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[color:var(--ventia-green)]">
              VenInspect
            </h1>
            <p className="text-sm text-[color:var(--ventia-muted)]">
              Sign in to continue
            </p>
          </div>
        </div>

        {error ? (
          <p
            className="mb-4 rounded-lg border border-rose-200 bg-[color:var(--danger-bg)] px-3 py-2 text-sm text-[color:var(--danger-fg)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {microsoftOn ? (
          <div className="mb-5 space-y-3">
            <Link
              href={microsoftHref}
              className="flex min-h-[var(--touch)] w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--field-bg)] px-4 py-2.5 text-sm font-semibold text-[color:var(--ventia-ink)] hover:bg-[color:var(--ventia-green-tint)]"
            >
              <MicrosoftIcon />
              Sign in with Microsoft
            </Link>
            <div className="flex items-center gap-3 text-xs text-[color:var(--ventia-muted)]">
              <span className="h-px flex-1 bg-[color:var(--ventia-border)]" />
              or use username / password
              <span className="h-px flex-1 bg-[color:var(--ventia-border)]" />
            </div>
          </div>
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
              autoFocus={!microsoftOn}
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
      </div>
    </div>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
