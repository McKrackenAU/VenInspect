"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

export function AppNav() {
  const pathname = usePathname();
  const isManage = pathname.startsWith("/manage");
  const links = isManage ? manageLinks : userLinks;

  return (
    <header className="no-print sticky top-0 z-20 border-b border-[color:var(--ventia-border)] bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
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
              {isManage ? "Office · manage" : "Field · inspect"}
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex" aria-label="Desktop">
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
          <Link
            href={isManage ? "/" : "/manage"}
            className="ml-2 rounded-lg border border-[color:var(--ventia-border)] px-3 py-2 text-xs font-medium text-[color:var(--ventia-muted)]"
          >
            {isManage ? "Field app" : "Office"}
          </Link>
        </nav>

        {/* Mobile: only switch portals — primary nav is bottom bar */}
        <Link
          href={isManage ? "/" : "/manage"}
          className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-2 text-xs font-semibold text-[color:var(--ventia-green)] md:hidden"
        >
          {isManage ? "Field" : "Office"}
        </Link>
      </div>
    </header>
  );
}
