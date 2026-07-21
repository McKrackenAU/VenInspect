import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ManageHomePage() {
  const [assetCount, userCount, byType] = await Promise.all([
    prisma.asset.count(),
    prisma.user.count(),
    prisma.asset.groupBy({ by: ["type"], _count: true }),
  ]);

  const typeMap = Object.fromEntries(byType.map((t) => [t.type, t._count]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
          Management portal
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[color:var(--ventia-muted)]">
          Maintain the asset registry and inspector accounts. Inspection work happens
          in the inspection portal. Microsoft work-account login (Entra ID + MFA) is
          planned — not enabled yet.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Assets in registry" value={String(assetCount)} href="/manage/assets" />
        <Stat label="Users" value={String(userCount)} href="/manage/users" />
        <Stat label="System / updates" value="→" href="/manage/system" />
        <Stat label="Severities" value="→" href="/manage/severities" />
        <Stat label="Inspection types" value="→" href="/manage/inspection-types" />
        <Stat
          label="Inspection templates"
          value="→"
          href="/manage/inspection-templates"
        />
        <Stat label="Import Excel / CSV" value="→" href="/manage/assets/import" />
      </section>

      <section className="rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-5 shadow-sm">
        <h2 className="font-medium text-[color:var(--ventia-ink)]">By type</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <li>Bridges: {typeMap.BRIDGE ?? 0}</li>
          <li>Drainage / culverts: {typeMap.DRAINAGE ?? 0}</li>
          <li>Noise walls: {typeMap.NOISE_WALL ?? 0}</li>
        </ul>
      </section>

      <p className="text-sm">
        <Link href="/" className="text-[color:var(--ventia-blue)] hover:underline">
          Open inspection portal
        </Link>
      </p>
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
      <p className="mt-1 text-3xl font-semibold text-[color:var(--ventia-green)]">
        {value}
      </p>
    </Link>
  );
}
