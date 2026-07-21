"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const userTabs = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/map", label: "Map", icon: MapIcon },
  { href: "/assets", label: "Find", icon: SearchIcon },
  { href: "/inspect", label: "Inspect", icon: CameraIcon, primary: true },
  { href: "/approvals", label: "Approve", icon: CheckIcon },
];

const manageTabs = [
  { href: "/manage", label: "Home", icon: HomeIcon },
  { href: "/manage/assets", label: "Assets", icon: ListIcon },
  { href: "/manage/assets/import", label: "Import", icon: UploadIcon },
  { href: "/manage/users", label: "People", icon: PeopleIcon },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const isManage = pathname.startsWith("/manage");
  const tabs = isManage ? manageTabs : userTabs;

  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return null;
  }

  // Hide on print / report-heavy pages where bottom chrome gets in the way
  if (pathname.includes("/report") || pathname.includes("/scope")) {
    return null;
  }

  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--ventia-border)] bg-[color:var(--nav-bg)] backdrop-blur md:hidden"
      style={{ paddingBottom: "var(--safe-bottom)" }}
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        {tabs.map((tab) => {
          const active =
            tab.href === "/" || tab.href === "/manage"
              ? pathname === tab.href
              : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-1 text-[0.65rem] font-medium ${
                  "primary" in tab && tab.primary
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
                    "primary" in tab && tab.primary
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

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 16V5M7 9l5-5 5 5M5 19h14" />
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
