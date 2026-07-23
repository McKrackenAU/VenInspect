"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export function ManageAssetTabs({
  main,
  details,
}: {
  main: ReactNode;
  details: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "details" ? "details" : "main";

  function setTab(next: "main" | "details") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "main") params.delete("tab");
    else params.set("tab", "details");
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-[color:var(--ventia-border)] pb-2">
        <button
          type="button"
          onClick={() => setTab("main")}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            tab === "main"
              ? "bg-[color:var(--ventia-green)] text-white"
              : "border border-[color:var(--ventia-border)]"
          }`}
        >
          Main
        </button>
        <button
          type="button"
          onClick={() => setTab("details")}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            tab === "details"
              ? "bg-[color:var(--ventia-green)] text-white"
              : "border border-[color:var(--ventia-border)]"
          }`}
        >
          Details
        </button>
      </div>
      {tab === "main" ? main : details}
    </div>
  );
}
