import Link from "next/link";
import { format } from "date-fns";
import {
  createAuditAssignmentAction,
  updateAuditAssignmentAction,
} from "@/lib/actions";
import { prisma } from "@/lib/db";
import { getInspectionTypes } from "@/lib/inspection-types";
import { formatLevel } from "@/lib/inspection";

export const dynamic = "force-dynamic";

const assignmentStatuses = [
  "PLANNED",
  "ASSIGNED",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
] as const;

export default async function ManageSchedulePage() {
  const [assignments, assets, users] = await Promise.all([
    prisma.auditAssignment.findMany({
      where: { status: { notIn: ["DONE", "CANCELLED"] } },
      include: { asset: true, assignedTo: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.asset.findMany({
      select: { id: true, assetNumber: true, roadName: true },
      orderBy: [{ roadName: "asc" }, { assetNumber: "asc" }],
    }),
    prisma.user.findMany({
      where: { OR: [{ username: null }, { username: { not: "root" } }] },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const inspectionTypes = getInspectionTypes();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
          Audit schedule
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Plan upcoming inspections and assign them to field inspectors.
        </p>
      </div>

      <form action={createAuditAssignmentAction} className="card grid gap-3 p-5 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Create assignment</h2>
        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="font-medium">Asset</span>
          <select name="assetId" required defaultValue="" className="field-input w-full">
            <option value="" disabled>
              Select an asset…
            </option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.roadName} · {asset.assetNumber}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Inspection level</span>
          <select name="level" className="field-input w-full">
            {inspectionTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Due date</span>
          <input name="dueDate" type="date" required className="field-input w-full" />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Assign to</span>
          <select name="assignedToId" defaultValue="" className="field-input w-full">
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Notes</span>
          <input name="notes" className="field-input w-full" />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary">
            Create assignment
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">Upcoming assignments</h2>
        {assignments.length === 0 ? (
          <p className="card px-4 py-5 text-sm text-[color:var(--ventia-muted)]">
            No upcoming assignments.
          </p>
        ) : (
          <ul className="card divide-y divide-[color:var(--ventia-border)] overflow-hidden">
            {assignments.map((assignment) => (
              <li
                key={assignment.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/assets/${assignment.assetId}`}
                    className="font-semibold text-[color:var(--ventia-green)] hover:underline"
                  >
                    {assignment.asset.assetNumber}
                  </Link>
                  <p className="text-sm text-[color:var(--ventia-muted)]">
                    {formatLevel(assignment.level)} · due{" "}
                    {format(assignment.dueDate, "dd MMM yyyy")} ·{" "}
                    {assignment.assignedTo?.name ?? "Unassigned"} ·{" "}
                    {assignment.status.replaceAll("_", " ")}
                  </p>
                  {assignment.notes ? (
                    <p className="mt-1 text-xs text-[color:var(--ventia-muted)]">
                      {assignment.notes}
                    </p>
                  ) : null}
                </div>
                <form action={updateAuditAssignmentAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={assignment.id} />
                  <input
                    type="hidden"
                    name="assignedToId"
                    value={assignment.assignedToId ?? ""}
                  />
                  <select
                    name="status"
                    defaultValue={assignment.status}
                    className="field-input text-sm"
                  >
                    {assignmentStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-2 text-sm font-medium"
                  >
                    Update
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
