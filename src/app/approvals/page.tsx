import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { approveInspection, rejectInspection } from "@/lib/actions";
import { formatLevel } from "@/lib/inspection";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const pending = await prisma.inspection.findMany({
    where: { status: "PENDING_APPROVAL" },
    include: { asset: true, createdBy: true, defects: true },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--ventia-green)]">Approvals</h1>
        <p className="mt-1 text-base text-[color:var(--ventia-muted)]">
          Level 2 checks waiting for a qualified person to confirm.
        </p>
      </div>

      {pending.length === 0 ? (
        <p className="card px-4 py-8 text-center text-[color:var(--ventia-muted)]">
          Nothing waiting. You&apos;re up to date.
        </p>
      ) : (
        <ul className="space-y-3">
          {pending.map((insp) => (
            <li key={insp.id} className="card space-y-3 p-4">
              <div>
                <Link
                  href={`/inspections/${insp.id}`}
                  className="text-lg font-bold text-[color:var(--ventia-green)]"
                >
                  {insp.titleLabel}
                </Link>
                <p className="text-sm text-[color:var(--ventia-muted)]">
                  {formatLevel(insp.level)} · {insp.createdBy.name} ·{" "}
                  {format(insp.submittedAt, "dd MMM yyyy HH:mm")} · {insp.defects.length}{" "}
                  defect{insp.defects.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <form action={approveInspection}>
                  <input type="hidden" name="inspectionId" value={insp.id} />
                  <button type="submit" className="btn-primary">
                    Approve
                  </button>
                </form>
                <form action={rejectInspection}>
                  <input type="hidden" name="inspectionId" value={insp.id} />
                  <button
                    type="submit"
                    className="btn-secondary w-full border-rose-600 text-rose-700"
                  >
                    Send back
                  </button>
                </form>
              </div>
              <Link
                href={`/inspections/${insp.id}`}
                className="block text-center text-sm font-semibold text-[color:var(--ventia-blue)]"
              >
                Open full details
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
