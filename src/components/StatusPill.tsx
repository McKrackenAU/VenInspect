import type { ScheduleStatus } from "@/lib/inspection";

const styles: Record<ScheduleStatus, string> = {
  ok: "bg-emerald-50 text-[color:var(--ventia-green)] ring-[color:var(--ventia-green-mid)]/40",
  due_soon: "bg-amber-50 text-amber-800 ring-amber-300",
  overdue: "bg-rose-50 text-rose-800 ring-rose-300",
  never: "bg-slate-100 text-slate-600 ring-slate-300",
};

const labels: Record<ScheduleStatus, string> = {
  ok: "On schedule",
  due_soon: "Due soon",
  overdue: "Overdue",
  never: "No prior report",
};

export function StatusPill({ status }: { status: ScheduleStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
