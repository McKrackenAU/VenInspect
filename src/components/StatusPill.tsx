import type { ScheduleStatus } from "@/lib/inspection";

const styles: Record<ScheduleStatus, string> = {
  ok: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  due_soon: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  overdue: "bg-rose-500/15 text-rose-200 ring-rose-500/30",
  never: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
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
