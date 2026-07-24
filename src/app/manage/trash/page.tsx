import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  purgeOldTrashAction,
  restoreInspectionAction,
} from "@/lib/trash";

export const dynamic = "force-dynamic";

export default async function ManageTrashPage() {
  await requireAdmin();
  const items = await prisma.inspection.findMany({
    where: { deletedAt: { not: null } },
    include: { asset: true, createdBy: true, deletedBy: true },
    orderBy: { deletedAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
            Trash
          </h1>
          <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
            Soft-deleted reports. Restored items return to normal lists. Items older
            than 30 days can be purged permanently.
          </p>
        </div>
        <form action={purgeOldTrashAction}>
          <button
            type="submit"
            className="rounded-md border border-rose-600 px-3 py-2 text-sm font-semibold text-rose-700"
          >
            Purge older than 30 days
          </button>
        </form>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[color:var(--ventia-muted)]">Trash is empty.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((i) => (
            <li
              key={i.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-4"
            >
              <div>
                <p className="font-medium">{i.titleLabel}</p>
                <p className="text-xs text-[color:var(--ventia-muted)]">
                  {i.asset.assetNumber} · deleted{" "}
                  {i.deletedAt ? format(i.deletedAt, "dd MMM yyyy HH:mm") : "—"}
                  {i.deletedBy ? ` by ${i.deletedBy.name}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/inspections/${i.id}`}
                  className="rounded-md border px-3 py-1.5 text-xs font-semibold"
                >
                  Open
                </Link>
                <form action={restoreInspectionAction}>
                  <input type="hidden" name="inspectionId" value={i.id} />
                  <button
                    type="submit"
                    className="rounded-md bg-[color:var(--ventia-green)] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Restore
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
