import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  loadAdminDashboard,
  parseDashboardRange,
} from "@/lib/admin-dashboard";
import { AdminLiveDashboard } from "@/components/AdminLiveDashboard";
import { getAssetTypes } from "@/lib/asset-types";

export const dynamic = "force-dynamic";

export default async function ManageHomePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const range = parseDashboardRange(sp.range);
  const [dashboard, assetCount, userCount, byType] = await Promise.all([
    loadAdminDashboard(range),
    prisma.asset.count(),
    prisma.user.count(),
    prisma.asset.groupBy({ by: ["type"], _count: true }),
  ]);
  const typeMap = Object.fromEntries(byType.map((t) => [t.type, t._count]));
  const assetTypes = getAssetTypes();

  return (
    <div className="space-y-6">
      <AdminLiveDashboard initial={dashboard} />

      <section className="space-y-3 border-t border-[color:var(--ventia-border)] pt-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--ventia-green)]">
              Tools & settings
            </h2>
            <p className="mt-0.5 text-sm text-[color:var(--ventia-muted)]">
              Same shortcuts as the admin Menu (☰) in the header.
            </p>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          <Stat label="Assets in registry" value={String(assetCount)} href="/manage/assets" />
          <Stat label="Users" value={String(userCount)} href="/manage/users" />
          <Stat label="Schedule board" value="→" href="/manage/schedule" />
          <Stat label="System / updates" value="→" href="/manage/system" />
          <Stat label="Condition states" value="→" href="/manage/severities" />
          <Stat label="Export configurator" value="→" href="/manage/export-config" />
          <Stat label="Inspection types" value="→" href="/manage/inspection-types" />
          <Stat label="Asset types" value="→" href="/manage/asset-types" />
          <Stat label="Document tags" value="→" href="/manage/document-tags" />
          <Stat
            label="Inspection templates"
            value="→"
            href="/manage/inspection-templates"
          />
          <Stat label="Import Excel / CSV" value="→" href="/manage/assets/import" />
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-medium">Registry by type</h3>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {assetTypes.map((t) => (
              <li key={t.value}>
                {t.label}: {typeMap[t.value] ?? 0}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm">
          <Link href="/" className="text-[color:var(--ventia-blue)] hover:underline">
            Open inspection portal
          </Link>
        </p>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] px-4 py-4 shadow-sm transition hover:border-[color:var(--ventia-green-mid)]"
    >
      <p className="text-xs uppercase tracking-wide text-[color:var(--ventia-muted)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-[color:var(--ventia-green)]">
        {value}
      </p>
    </Link>
  );
}
