import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/assets", label: "Assets" },
  { href: "/inspect", label: "Inspect" },
  { href: "/approvals", label: "Approvals" },
  { href: "/admin", label: "Admin" },
];

export function AppNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight text-teal-300">
          VenInspect
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-2.5 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
