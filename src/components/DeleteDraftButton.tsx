"use client";

import { deleteDraftInspection } from "@/lib/actions";

export function DeleteDraftButton({
  inspectionId,
  next = "/",
  label = "Delete",
}: {
  inspectionId: string;
  next?: string;
  label?: string;
}) {
  return (
    <form
      action={deleteDraftInspection}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Delete this draft permanently? Defects and notes in the draft will be lost.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="inspectionId" value={inspectionId} />
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        className="rounded-lg border border-rose-400/60 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300"
      >
        {label}
      </button>
    </form>
  );
}
