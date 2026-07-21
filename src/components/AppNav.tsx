"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/auth-actions";

const userLinks = [
  { href: "/", label: "Home" },
  { href: "/assets", label: "Find asset" },
  { href: "/inspect", label: "Start inspection" },
  { href: "/approvals", label: "Approvals" },
];

const manageLinks = [
  { href: "/manage", label: "Home" },
  { href: "/manage/assets", label: "Assets" },
  { href: "/manage/assets/import", label: "Import" },
  { href: "/manage/storage", label: "Photos" },
  { href: "/manage/users", label: "People" },
];

type Props = {
  userName?: string | null;
  isAdmin?: boolean;
};

export function AppNav({ userName, isAdmin }: Props) {
  const pathname = usePathname();
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return null;
  }

  const isManage = pathname.startsWith("/manage");
  const links = isManage ? manageLinks : userLinks;

  return (
    <header className="no-print sticky top-0 z-20 border-b border-[color:var(--ventia-border)] bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href={isManage ? "/manage" : "/"} className="flex items-center gap-2">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{
              background:
                "conic-gradient(from 210deg, var(--ventia-green), var(--ventia-blue), var(--ventia-green-mid), var(--ventia-green))",
            }}
            aria-hidden
          >
            V
          </span>
          <div className="leading-tight">
            <span className="block font-semibold tracking-tight text-[color:var(--ventia-green)]">
              VenInspect
            </span>
            <span className="block text-[0.65rem] text-[color:var(--ventia-muted)]">
              {isManage ? "Management portal" : "User portal"}
            </span>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {/* Clear portal switch */}
          <div
            className="inline-flex rounded-lg border border-[color:var(--ventia-border)] p-0.5 text-xs font-semibold"
            role="group"
            aria-label="Portal"
          >
            <Link
              href="/"
              className={`rounded-md px-3 py-1.5 ${
                !isManage
                  ? "bg-[color:var(--ventia-green)] text-white"
                  : "text-[color:var(--ventia-muted)] hover:bg-[color:var(--ventia-green-tint)]"
              }`}
            >
              User
            </Link>
            {isAdmin ? (
              <Link
                href="/manage"
                className={`rounded-md px-3 py-1.5 ${
                  isManage
                    ? "bg-[color:var(--ventia-green)] text-white"
                    : "text-[color:var(--ventia-muted)] hover:bg-[color:var(--ventia-green-tint)]"
                }`}
              >
                Admin
              </Link>
            ) : (
              <span
                className="cursor-not-allowed rounded-md px-3 py-1.5 text-[color:var(--ventia-border)]"
                title="Admin only"
              >
                Admin
              </span>
            )}
          </div>

          {userName ? (
            <span className="hidden text-xs text-[color:var(--ventia-muted)] sm:inline">
              {userName}
            </span>
          ) : null}

          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--ventia-muted)] hover:bg-[color:var(--ventia-green-tint)]"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      <nav
        className="mx-auto hidden max-w-6xl items-center gap-1 px-4 pb-2 text-sm md:flex"
        aria-label="Desktop"
      >
        {links.map((l) => {
          const active =
            l.href === "/" || l.href === "/manage"
              ? pathname === l.href
              : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 ${
                active
                  ? "bg-[color:var(--ventia-green-tint)] font-semibold text-[color:var(--ventia-green)]"
                  : "text-[color:var(--ventia-ink)] hover:bg-[color:var(--ventia-green-tint)]"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
