import { formatAppVersion, getAppVersion } from "@/lib/version";

export function AppFooter() {
  const version = formatAppVersion(getAppVersion());
  return (
    <footer className="no-print mt-auto border-t border-[color:var(--ventia-border)] px-4 py-4 text-center text-xs text-[color:var(--ventia-muted)] pb-[calc(1rem+var(--safe-bottom))] md:pb-4">
      <p>
        VenInspect {version}
        <span className="mx-2 opacity-40">·</span>
        Field inspections
      </p>
    </footer>
  );
}
