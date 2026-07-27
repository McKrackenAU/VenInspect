import { redirect } from "next/navigation";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { readStorageSettings } from "@/lib/paths";
import { isRootUsername } from "@/lib/roles";
import { TunnelConfigForm } from "@/components/TunnelConfigForm";

export const dynamic = "force-dynamic";

export default async function TunnelPage() {
  await requireAdmin();
  const user = await getCurrentUser();
  if (!isRootUsername(user?.username)) {
    redirect("/manage/system");
  }
  const settings = readStorageSettings();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
          Cloudflare Tunnel
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Root-only. Expose VenInspect without opening office firewall ports. Create a
          tunnel in the Cloudflare Zero Trust dashboard, then paste the token here.
          On the LXC, install cloudflared with{" "}
          <code className="font-mono text-xs">deploy/install-cloudflared.sh</code>.
        </p>
      </div>
      <TunnelConfigForm
        token={settings.cloudflareTunnelToken ?? ""}
        hostname={settings.cloudflareTunnelHostname ?? ""}
      />
    </div>
  );
}
