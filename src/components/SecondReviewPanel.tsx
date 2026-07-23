"use client";

import { useState, useTransition } from "react";
import {
  requestSecondReviewAction,
  completeSecondReviewAction,
  skipSecondReviewAction,
} from "@/lib/actions";

export type ReviewCandidate = {
  id: string;
  name: string;
  level2Qualified: boolean;
};

export function SecondReviewPanel({
  inspectionId,
  reviewStatus,
  reviewNote,
  requestedFromName,
  reviewedByLabel,
  reviewedAtLabel,
  candidates,
  isCreator,
  isRequestedReviewer,
  canComplete,
}: {
  inspectionId: string;
  reviewStatus: string;
  reviewNote: string | null;
  requestedFromName: string | null;
  reviewedByLabel: string | null;
  reviewedAtLabel: string | null;
  candidates: ReviewCandidate[];
  isCreator: boolean;
  isRequestedReviewer: boolean;
  /** True when current user can stamp a review (not the creator) */
  canComplete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [reviewerId, setReviewerId] = useState(candidates[0]?.id ?? "");
  const [note, setNote] = useState("");

  function run(action: (fd: FormData) => Promise<void>, extra?: Record<string, string>) {
    setMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("inspectionId", inspectionId);
      if (extra) {
        for (const [k, v] of Object.entries(extra)) fd.set(k, v);
      }
      try {
        await action(fd);
        setMessage("Updated.");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <section className="no-print card space-y-3 p-4">
      <div>
        <h2 className="font-semibold text-[color:var(--ventia-green)]">
          Second review
        </h2>
        <p className="mt-1 text-xs text-[color:var(--ventia-muted)]">
          Optionally ask another inspector for a second look. Their name only appears on the
          report if they confirm the review while logged into their own account. Skip cancels
          without adding a reviewed-by line.
        </p>
      </div>

      {reviewStatus === "NONE" || reviewStatus === "SKIPPED" ? (
        isCreator ? (
          <div className="space-y-2">
            {reviewStatus === "SKIPPED" ? (
              <p className="text-xs text-[color:var(--ventia-muted)]">
                Previous request was skipped. You can request again if needed.
              </p>
            ) : null}
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Ask</span>
              <select
                className="field-input w-full"
                value={reviewerId}
                onChange={(e) => setReviewerId(e.target.value)}
              >
                {candidates.length === 0 ? (
                  <option value="">No other users available</option>
                ) : (
                  candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.level2Qualified ? " (L2)" : ""}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Note (optional)</span>
              <input
                className="field-input w-full"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything to check in particular?"
              />
            </label>
            <button
              type="button"
              disabled={pending || !reviewerId}
              className="btn-primary"
              onClick={() =>
                run(requestSecondReviewAction, {
                  reviewerId,
                  reviewNote: note,
                })
              }
            >
              {pending ? "Sending…" : "Request second review"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-[color:var(--ventia-muted)]">
            No second review requested.
          </p>
        )
      ) : null}

      {reviewStatus === "REQUESTED" ? (
        <div className="space-y-2">
          <p className="text-sm">
            Waiting on{" "}
            <span className="font-semibold">{requestedFromName ?? "another inspector"}</span>
            {reviewNote ? (
              <span className="block text-xs text-[color:var(--ventia-muted)]">
                Note: {reviewNote}
              </span>
            ) : null}
          </p>
          {canComplete || isRequestedReviewer ? (
            <button
              type="button"
              disabled={pending}
              className="btn-primary"
              onClick={() => run(completeSecondReviewAction)}
            >
              {pending ? "Saving…" : "Confirm I have reviewed this"}
            </button>
          ) : null}
          {isCreator ? (
            <button
              type="button"
              disabled={pending}
              className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
              onClick={() => {
                if (
                  !window.confirm(
                    "Skip this second review? No “reviewed by” line will appear on the report.",
                  )
                ) {
                  return;
                }
                run(skipSecondReviewAction);
              }}
            >
              Don&apos;t worry about it — skip review
            </button>
          ) : null}
          {!canComplete && isCreator ? (
            <p className="text-xs text-[color:var(--ventia-muted)]">
              Open this report on the other person&apos;s login to confirm review. Viewing it
              here as the original inspector will not add their name.
            </p>
          ) : null}
        </div>
      ) : null}

      {reviewStatus === "COMPLETED" && reviewedByLabel ? (
        <p className="text-sm">
          Reviewed by <span className="font-semibold">{reviewedByLabel}</span>
          {reviewedAtLabel ? (
            <span className="text-[color:var(--ventia-muted)]"> · {reviewedAtLabel}</span>
          ) : null}
        </p>
      ) : null}

      {message ? (
        <p className="text-xs text-[color:var(--ventia-muted)]">{message}</p>
      ) : null}
    </section>
  );
}
