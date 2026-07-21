"use client";

export function PrintButton({
  label = "Export PDF",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        className ??
        "rounded-md bg-[color:var(--ventia-green)] px-3 py-2 text-sm font-semibold text-white"
      }
    >
      {label}
    </button>
  );
}
