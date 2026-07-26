"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminLinkActive, adminPrimaryLinks } from "@/lib/admin-nav";

const userTabs = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/map", label: "Map", icon: MapIcon },
  { href: "/assets", label: "Find", icon: SearchIcon },
  { href: "/inspect", label: "Inspect", icon: CameraIcon, primary: true },
  { href: "/approvals", label: "Approve", icon: CheckIcon },
];

const manageIcons: Record<string, () => React.ReactNode> = {
  "/manage": HomeIcon,
  "/manage/assets": ListIcon,
  "/manage/reports": DocsIcon,
  "/manage/schedule": CalendarIcon,
  "/manage/users": PeopleIcon,
};

export function MobileBottomNav() {
  const pathname = usePathname();
  const isManage = pathname.startsWith("/manage");

  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return null;
  }

  // Hide on print / report-heavy pages where bottom chrome gets in the way
  if (pathname.includes("/report") || pathname.includes("/scope")) {
    return null;
  }

  const tabs = isManage
    ? adminPrimaryLinks.map((l) => ({
        href: l.href,
        label: l.label === "Dashboard" ? "Home" : l.label,
        icon: manageIcons[l.href] ?? ListIcon,
      }))
    : userTabs;

  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--ventia-border)] bg-[color:var(--nav-bg)] backdrop-blur md:hidden"
      style={{ paddingBottom: "var(--safe-bottom)" }}
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        {tabs.map((tab) => {
          const active = isManage
            ? adminLinkActive(pathname, tab.href)
            : tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          const isPrimary = "primary" in tab && tab.primary;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-1 text-[0.65rem] font-medium ${
                  isPrimary
                    ? active
                      ? "text-[color:var(--ventia-green)]"
                      : "text-[color:var(--ventia-green-mid)]"
                    : active
                      ? "text-[color:var(--ventia-green)]"
                      : "text-[color:var(--ventia-muted)]"
                }`}
              >
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                    isPrimary
                      ? "bg-[color:var(--ventia-green)] text-white shadow-sm"
                      : active
                        ? "bg-[color:var(--ventia-green-tint)]"
                        : ""
                  }`}
                >
                  <Icon />
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 4 3 6.5v13L9 17l6 2.5L21 17V4l-6 2.5L9 4z" />
      <path d="M9 4v13M15 6.5V19" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 8h3l2-2h6l2 2h3v11H4V8z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M21 19c0-2.2-1.5-3.8-3.5-4.4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </svg>
  );
}

function DocsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}
