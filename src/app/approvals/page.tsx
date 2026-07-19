import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { approveInspection, rejectInspection } from "@/lib/actions";
import { formatLevel } from "@/lib/inspection";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const [pending, recent] = await Promise.all([
    prisma.inspection.findMany({
      where: { status: "PENDING_APPROVAL" },
      include: { asset: true, createdBy: true, defects: true },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.notification.findMany({
      include: { inspection: { include: { asset: true } }, user: true },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Approvals</h1>
        <p className="mt-1 text-sm text-slate-400">
          Level 2 inspectors verify Level 2 drafts submitted by Level 1 inspectors.
          Demo approver: Jordan Level2.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-6 text-sm text-slate-400">
            No inspections waiting for Level 2 approval.
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map((insp) => (
              <li
                key={insp.id}
                className="rounded-xl border border-amber-900/40 bg-slate-900/70 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/inspections/${insp.id}`}
                      className="font-medium text-teal-200 hover:underline"
                    >
                      {insp.asset.assetNumber} — {insp.asset.name}
                    </Link>
                    <p className="mt-0.5 text-sm text-slate-400">
                      {formatLevel(insp.level)} · by {insp.createdBy.name} ·{" "}
                      {insp.submittedAt
                        ? format(insp.submittedAt, "dd MMM yyyy HH:mm")
                        : "—"}{" "}
                      · {insp.defects.length} defect
                      {insp.defects.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={approveInspection}>
                      <input type="hidden" name="inspectionId" value={insp.id} />
                      <button
                        type="submit"
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
                      >
                        Approve
                      </button>
                    </form>
                    <form action={rejectInspection}>
                      <input type="hidden" name="inspectionId" value={insp.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-rose-700/60 px-3 py-1.5 text-sm text-rose-200 hover:bg-rose-950"
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">Notification log</h2>
        <ul className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
          {recent.map((n) => (
            <li key={n.id} className="px-4 py-3 text-sm">
              <p className="font-medium text-slate-100">{n.title}</p>
              <p className="text-slate-400">{n.message}</p>
              <p className="mt-1 text-xs text-slate-500">
                → {n.user.name} · {format(n.createdAt, "dd MMM HH:mm")}
                {n.read ? " · read" : " · unread"}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
