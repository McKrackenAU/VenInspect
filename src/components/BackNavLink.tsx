"use client";

import { useRouter } from "next/navigation";

/** Prefer browser history; fall back when there is no in-app history (e.g. deep link). */
export function BackNavLink({
  fallbackHref,
  children = "← Go back",
  className = "text-sm text-[color:var(--ventia-blue)] hover:underline",
}: {
  fallbackHref: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
    >
      {children}
    </button>
  );
}
