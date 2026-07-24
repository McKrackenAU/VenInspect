"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminLinkActive, adminMenuGroups } from "@/lib/admin-nav";

type Props = {
  /** Compact icon-only control for the top-left corner */
  variant?: "icon" | "labeled";
};

export function AdminSideMenu({ variant = "icon" }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const drawer =
    open && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[100]" role="presentation">
            <button
              type="button"
              className="absolute inset-0 bg-black/55"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            />
            <aside
              id="admin-side-menu"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="absolute inset-y-0 left-0 flex h-full w-[min(22rem,92vw)] flex-col border-r border-[color:var(--ventia-border)] bg-[color:var(--panel)] shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[color:var(--ventia-border)] px-4 py-3">
                <div>
                  <p
                    id={titleId}
                    className="font-semibold text-[color:var(--ventia-green)]"
                  >
                    Admin menu
                  </p>
                  <p className="text-xs text-[color:var(--ventia-muted)]">
                    Tools & settings
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-[color:var(--ventia-border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[color:var(--ventia-green-tint)]"
                >
                  Close
                </button>
              </div>

              <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
                {adminMenuGroups.map((group) => (
                  <section key={group.title} className="mb-5">
                    <h2 className="px-2 text-[0.65rem] font-semibold uppercase tracking-wider text-[color:var(--ventia-muted)]">
                      {group.title}
                    </h2>
                    <ul className="mt-1.5 space-y-0.5">
                      {group.links.map((link) => {
                        const active = adminLinkActive(pathname, link.href);
                        return (
                          <li key={`${group.title}-${link.href}`}>
                            <Link
                              href={link.href}
                              onClick={() => setOpen(false)}
                              className={`block rounded-xl px-3 py-2.5 transition ${
                                active
                                  ? "bg-[color:var(--ventia-green-tint)] text-[color:var(--ventia-green)]"
                                  : "text-[color:var(--ventia-ink)] hover:bg-[color:var(--ventia-green-tint)]"
                              }`}
                            >
                              <span className="block text-sm font-semibold">
                                {link.label}
                              </span>
                              {link.description ? (
                                <span className="mt-0.5 block text-[11px] font-normal text-[color:var(--ventia-muted)]">
                                  {link.description}
                                </span>
                              ) : null}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </nav>

              <div className="shrink-0 border-t border-[color:var(--ventia-border)] px-4 py-3">
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="text-sm font-medium text-[color:var(--ventia-blue)] hover:underline"
                >
                  ← Open inspection portal
                </Link>
              </div>
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "icon"
            ? "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[color:var(--ventia-border)] text-[color:var(--ventia-ink)] hover:bg-[color:var(--ventia-green-tint)]"
            : "inline-flex items-center gap-2 rounded-lg border border-[color:var(--ventia-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ventia-ink)] hover:bg-[color:var(--ventia-green-tint)]"
        }
        aria-expanded={open}
        aria-controls="admin-side-menu"
        aria-haspopup="dialog"
        aria-label="Open admin menu"
        title="Admin menu"
      >
        <HamburgerIcon />
        {variant === "labeled" ? <span>Menu</span> : null}
      </button>
      {drawer}
    </>
  );
}

function HamburgerIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
