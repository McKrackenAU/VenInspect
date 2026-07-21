import Link from "next/link";
import { loginAction } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const error = params.error === "1";
  const next = params.next && params.next.startsWith("/") ? params.next : "/";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-1 py-8">
      <div className="rounded-2xl border border-[color:var(--ventia-border)] bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span
            className="inline-flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
            style={{
              background:
                "conic-gradient(from 210deg, var(--ventia-green), var(--ventia-blue), var(--ventia-green-mid), var(--ventia-green))",
            }}
            aria-hidden
          >
            V
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[color:var(--ventia-green)]">
              VenInspect
            </h1>
            <p className="text-sm text-[color:var(--ventia-muted)]">Sign in to continue</p>
          </div>
        </div>

        {error ? (
          <p
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            Invalid username or password.
          </p>
        ) : null}

        <form action={loginAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[color:var(--ventia-ink)]">
              Username
            </span>
            <input
              name="login"
              type="text"
              autoComplete="username"
              required
              defaultValue="root"
              className="w-full rounded-xl border border-[color:var(--ventia-border)] px-3 py-3 text-base outline-none focus:border-[color:var(--ventia-green-mid)] focus:ring-2 focus:ring-[color:var(--ventia-green-mid)]/25"
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
              className="w-full rounded-xl border border-[color:var(--ventia-border)] px-3 py-3 text-base outline-none focus:border-[color:var(--ventia-green-mid)] focus:ring-2 focus:ring-[color:var(--ventia-green-mid)]/25"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-[color:var(--ventia-green)] px-4 py-3 text-base font-semibold text-white hover:bg-[color:var(--ventia-green-mid)]"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[color:var(--ventia-muted)]">
          Default admin: <code className="font-mono">root</code> /{" "}
          <code className="font-mono">calvin</code>
        </p>
      </div>
      <p className="mt-4 text-center text-xs text-[color:var(--ventia-muted)]">
        <Link href="/" className="underline-offset-2 hover:underline">
          VenInspect
        </Link>
      </p>
    </div>
  );
}
