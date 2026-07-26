import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { restoreInspectionAction } from "@/lib/trash";
import {
  TrashPurgeAllButtons,
  TrashPurgeItemButton,
} from "@/components/TrashPurgeControls";

export const dynamic = "force-dynamic";

export default async function ManageTrashPage() {
  await requireAdmin();

  let items: Awaited<
    ReturnType<
      typeof prisma.inspection.findMany<{
        include: { asset: true; deletedBy: true };
      }>
    >
  > = [];
  let loadError: string | null = null;

  try {
    items = await prisma.inspection.findMany({
      where: { deletedAt: { not: null } },
      include: { asset: true, deletedBy: true },
      orderBy: { deletedAt: "desc" },
      take: 200,
    });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load trash";
    try {
      // Fallback without deletedBy relation (older clients / odd DB state)
      items = (await prisma.inspection.findMany({
        where: { deletedAt: { not: null } },
        include: { asset: true },
        orderBy: { deletedAt: "desc" },
        take: 200,
      })) as typeof items;
      loadError = null;
    } catch (e2) {
      loadError = e2 instanceof Error ? e2.message : loadError;
      items = [];
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
          Trash
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Soft-deleted reports. Restore to bring them back, or purge to permanently
          remove the report and its photos.
        </p>
      </div>

      <TrashPurgeAllButtons />

      {loadError ? (
        <p className="text-sm text-rose-600" role="alert">
          {loadError}
        </p>
      ) : null}

      {items.length === 0 && !loadError ? (
        <p className="text-sm text-[color:var(--ventia-muted)]">Trash is empty.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((i) => (
            <li
              key={i.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-4"
            >
              <div className="min-w-0">
                <p className="font-medium">{i.titleLabel}</p>
                <p className="text-xs text-[color:var(--ventia-muted)]">
                  {i.asset.assetNumber} · deleted{" "}
                  {i.deletedAt
                    ? format(new Date(i.deletedAt), "dd MMM yyyy HH:mm")
                    : "—"}
                  {i.deletedBy ? ` by ${i.deletedBy.name}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/inspections/${i.id}`}
                  className="rounded-md border border-[color:var(--ventia-border)] px-3 py-1.5 text-xs font-semibold"
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
                <TrashPurgeItemButton
                  inspectionId={i.id}
                  titleLabel={i.titleLabel}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
