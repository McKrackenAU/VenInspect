import { formatAppVersion, getAppVersion } from "@/lib/version";
import { BrandMark } from "@/components/BrandMark";
import { FooterInstallButton } from "@/components/FooterInstallButton";

export function AppFooter() {
  const version = formatAppVersion(getAppVersion());
  return (
    <footer className="no-print mt-auto border-t border-[color:var(--ventia-border)] px-4 py-4 text-center text-xs text-[color:var(--ventia-muted)] pb-[calc(1rem+var(--safe-bottom))] md:pb-4">
      <div className="inline-flex items-center justify-center gap-2.5">
        <BrandMark size={18} className="opacity-90" />
        <span>
          VenInspect {version}
          <span className="mx-2 opacity-40">·</span>
          Field inspections
        </span>
        <FooterInstallButton />
      </div>
    </footer>
  );
}
