import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  approveInspection,
  rejectInspection,
  completeSecondReviewAction,
} from "@/lib/actions";
import { formatLevel } from "@/lib/inspection";
import { canApproveLevel2, formatPersonCredential } from "@/lib/report-people";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const user = await requireUser();
  const canApprove = canApproveLevel2(user);

  const pendingApprovals = canApprove
    ? await prisma.inspection.findMany({
        where: { status: "PENDING_APPROVAL" },
        include: { asset: true, createdBy: true, defects: true },
        orderBy: { submittedAt: "desc" },
      })
    : [];

  const pendingReviews = await prisma.inspection.findMany({
    where: {
      reviewStatus: "REQUESTED",
      reviewRequestedFromId: user.id,
    },
    include: { asset: true, createdBy: true, defects: true },
    orderBy: { submittedAt: "desc" },
  });

  if (!canApprove && pendingReviews.length === 0) {
    // L1 with nothing to review — explain they cannot approve L2
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-[color:var(--ventia-green)]">
          Approvals
        </h1>
        <p className="card px-4 py-6 text-sm text-[color:var(--ventia-muted)]">
          Level 2 inspection approvals are only available to Level 2 qualified
          inspectors (and admins). You have no second-review requests right now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--ventia-green)]">
          Approvals
        </h1>
        <p className="mt-1 text-base text-[color:var(--ventia-muted)]">
          {canApprove
            ? "Level 2 checks waiting for a qualified person, plus second reviews asked of you."
            : "Second reviews that other inspectors asked you to complete."}
        </p>
      </div>

      {canApprove ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Level 2 approval queue</h2>
          {pendingApprovals.length === 0 ? (
            <p className="card px-4 py-6 text-center text-[color:var(--ventia-muted)]">
              Nothing waiting for Level 2 approval.
            </p>
          ) : (
            <ul className="space-y-3">
              {pendingApprovals.map((insp) => (
                <li key={insp.id} className="card space-y-3 p-4">
                  <div>
                    <Link
                      href={`/inspections/${insp.id}`}
                      className="text-lg font-bold text-[color:var(--ventia-green)]"
                    >
                      {insp.titleLabel}
                    </Link>
                    <p className="text-sm text-[color:var(--ventia-muted)]">
                      {formatLevel(insp.level)} ·{" "}
                      {formatPersonCredential({
                        name: insp.createdBy.name,
                        registrationNumber: insp.createdBy.registrationNumber,
                        level1Qualified: insp.createdBy.level1Qualified,
                        level2Qualified: insp.createdBy.level2Qualified,
                      })}{" "}
                      · {format(insp.submittedAt, "dd MMM yyyy HH:mm")} ·{" "}
                      {insp.defects.length} defect
                      {insp.defects.length === 1 ? "" : "s"}
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
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Second reviews for you</h2>
        {pendingReviews.length === 0 ? (
          <p className="card px-4 py-6 text-center text-[color:var(--ventia-muted)]">
            No second-review requests.
          </p>
        ) : (
          <ul className="space-y-3">
            {pendingReviews.map((insp) => (
              <li key={insp.id} className="card space-y-3 p-4">
                <div>
                  <Link
                    href={`/inspections/${insp.id}/report`}
                    className="text-lg font-bold text-[color:var(--ventia-green)]"
                  >
                    {insp.titleLabel}
                  </Link>
                  <p className="text-sm text-[color:var(--ventia-muted)]">
                    From {insp.createdBy.name}
                    {insp.reviewNote ? ` — “${insp.reviewNote}”` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={completeSecondReviewAction}>
                    <input type="hidden" name="inspectionId" value={insp.id} />
                    <button type="submit" className="btn-primary">
                      Confirm I have reviewed this
                    </button>
                  </form>
                  <Link
                    href={`/inspections/${insp.id}/report`}
                    className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-2 text-sm font-semibold"
                  >
                    Open report
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
