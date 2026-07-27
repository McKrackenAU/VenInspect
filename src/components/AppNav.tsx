"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/auth-actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandMark } from "@/components/BrandMark";
import { AdminSideMenu } from "@/components/AdminSideMenu";
import { adminLinkActive, adminPrimaryLinks } from "@/lib/admin-nav";

const userLinks = [
  { href: "/", label: "Home" },
  { href: "/map", label: "Map" },
  { href: "/assets", label: "Find asset" },
  { href: "/inspect", label: "Start inspection" },
  { href: "/approvals", label: "Approvals" },
];

type Props = {
  userName?: string | null;
  isAdmin?: boolean;
  /** Root system account — admin portal only */
  isRoot?: boolean;
};

export function AppNav({ userName, isAdmin, isRoot }: Props) {
  const pathname = usePathname();
  if (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/forgot-password/") ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/")
  ) {
    return null;
  }

  const isManage = pathname.startsWith("/manage");
  const links = isManage ? adminPrimaryLinks : userLinks;

  return (
    <header className="no-print sticky top-0 z-20 border-b border-[color:var(--ventia-border)] bg-[color:var(--nav-bg)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-[96rem] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6 xl:max-w-[110rem] 2xl:max-w-[128rem] 2xl:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {isManage ? <AdminSideMenu variant="icon" /> : null}
          <Link
            href={isManage ? "/manage" : "/"}
            className="flex min-w-0 items-center gap-2"
          >
            <BrandMark size={36} priority />
            <div className="leading-tight">
              <span className="block font-semibold tracking-tight text-[color:var(--ventia-green)]">
                VenInspect
              </span>
              <span className="block text-[0.65rem] text-[color:var(--ventia-muted)]">
                {isManage ? "Admin portal" : "User portal"}
              </span>
            </div>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && !isRoot ? (
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
            </div>
          ) : null}

          {userName ? (
            isRoot ? (
              <span className="hidden rounded-lg px-2 py-1.5 text-xs text-[color:var(--ventia-muted)] sm:inline">
                {userName}
              </span>
            ) : (
              <Link
                href="/account"
                className={`hidden rounded-lg px-2 py-1.5 text-xs sm:inline ${
                  pathname === "/account" || pathname.startsWith("/account/")
                    ? "font-semibold text-[color:var(--ventia-green)]"
                    : "text-[color:var(--ventia-muted)] hover:bg-[color:var(--ventia-green-tint)]"
                }`}
                title="Account & password"
              >
                {userName}
              </Link>
            )
          ) : null}

          <ThemeToggle />

          {!isRoot ? (
            <Link
              href="/account"
              className={`rounded-lg border border-[color:var(--ventia-border)] px-3 py-1.5 text-xs font-medium hover:bg-[color:var(--ventia-green-tint)] ${
                pathname === "/account" || pathname.startsWith("/account/")
                  ? "border-[color:var(--ventia-green)] font-semibold text-[color:var(--ventia-green)]"
                  : "text-[color:var(--ventia-muted)]"
              }`}
            >
              Account
            </Link>
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
        className="mx-auto hidden w-full max-w-[96rem] items-center gap-1 px-4 pb-2 text-sm md:flex md:px-6 xl:max-w-[110rem] 2xl:max-w-[128rem] 2xl:px-8"
        aria-label="Desktop"
      >
        {links.map((l) => {
          const active = isManage
            ? adminLinkActive(pathname, l.href)
            : l.href === "/"
              ? pathname === "/"
              : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 ${
                active
                  ? "bg-[color:var(--ventia-green-tint)] font-semibold text-[color:var(--ventia-green)] underline decoration-2 underline-offset-8"
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
