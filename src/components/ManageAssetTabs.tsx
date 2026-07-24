"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export function ManageAssetTabs({
  main,
  details,
  history,
}: {
  main: ReactNode;
  details: ReactNode;
  history?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab");
  const tab =
    raw === "details" ? "details" : raw === "history" ? "history" : "main";

  function setTab(next: "main" | "details" | "history") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "main") params.delete("tab");
    else params.set("tab", next);
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-[color:var(--ventia-border)] pb-2">
        {(
          [
            ["main", "Main"],
            ["details", "Details"],
            ...(history ? ([["history", "Condition history"]] as const) : []),
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              tab === id
                ? "bg-[color:var(--ventia-green)] text-white"
                : "border border-[color:var(--ventia-border)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "main" ? main : tab === "details" ? details : history}
    </div>
  );
}
