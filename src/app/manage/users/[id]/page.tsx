import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatLevel, formatStatus } from "@/lib/inspection";

export const dynamic = "force-dynamic";

export default async function ManageUserHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      inspectionsCreated: {
        include: { asset: true, defects: true },
        orderBy: { submittedAt: "desc" },
        take: 100,
      },
    },
  });
  if (!user) notFound();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-[color:var(--ventia-muted)]">
          <Link href="/manage/users" className="hover:underline">
            People
          </Link>{" "}
          / history
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[color:var(--ventia-green)]">
          {user.name}
        </h1>
        <p className="text-sm text-[color:var(--ventia-muted)]">
          {user.username ? `${user.username} · ` : ""}
          {user.email} · {user.role}
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Inspections (including drafts)</h2>
        {user.inspectionsCreated.length === 0 ? (
          <p className="text-sm text-[color:var(--ventia-muted)]">No inspections yet.</p>
        ) : (
          <ul className="divide-y divide-[color:var(--ventia-border)] overflow-hidden rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)]">
            {user.inspectionsCreated.map((insp) => (
              <li key={insp.id} className="px-4 py-3">
                <Link
                  href={`/inspections/${insp.id}`}
                  className="font-medium text-[color:var(--ventia-green)] hover:underline"
                >
                  {insp.titleLabel}
                </Link>
                <p className="text-xs text-[color:var(--ventia-muted)]">
                  {insp.asset.assetNumber} · {formatLevel(insp.level)} ·{" "}
                  {formatStatus(insp.status)} ·{" "}
                  {format(insp.submittedAt, "dd MMM yyyy HH:mm")} ·{" "}
                  {insp.defects.length} defects
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
