import Link from "next/link";

/** Navigates to the Client Export page (condition filter + photo order + ZIP). */
export function ClientExportButton({
  inspectionId,
  className,
}: {
  inspectionId: string;
  /** Kept for call-site compatibility; unused (page loads its own defaults). */
  conditionStates?: unknown;
  defaultSelected?: unknown;
  className?: string;
}) {
  return (
    <Link
      href={`/inspections/${inspectionId}/client-export`}
      className={
        className ??
        "rounded-md border border-[color:var(--ventia-green)] px-3 py-2 text-sm font-semibold text-[color:var(--ventia-green)]"
      }
    >
      Client Export
    </Link>
  );
}
