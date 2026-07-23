"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDocumentTagsAction } from "@/lib/actions";
import type { DocumentTagOption } from "@/lib/document-tags";

export function DocumentTagsForm({
  initial,
}: {
  initial: DocumentTagOption[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<DocumentTagOption[]>(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function update(index: number, patch: Partial<DocumentTagOption>) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  return (
    <form
      className="space-y-4"
      action={() => {
        setMessage(null);
        startTransition(async () => {
          const formData = new FormData();
          formData.set("tagsJson", JSON.stringify(rows));
          try {
            await saveDocumentTagsAction(formData);
            setMessage("Saved.");
            router.refresh();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Save failed");
          }
        });
      }}
    >
      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li key={index} className="flex flex-wrap items-center gap-2">
            <input
              value={row.value}
              onChange={(event) => update(index, { value: event.target.value })}
              placeholder="VALUE"
              className="field-input max-w-[10rem] font-mono text-sm uppercase"
            />
            <input
              value={row.label}
              onChange={(event) => update(index, { label: event.target.value })}
              placeholder="Label shown to users"
              className="field-input min-w-[12rem] flex-1"
            />
            <button
              type="button"
              className="rounded-lg border border-rose-300 px-2 py-1 text-xs text-rose-700 dark:border-rose-800 dark:text-rose-300"
              onClick={() =>
                setRows((current) =>
                  current.filter((_, rowIndex) => rowIndex !== index),
                )
              }
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
        onClick={() =>
          setRows((current) => [...current, { value: "", label: "" }])
        }
      >
        + Add document tag
      </button>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save document tags"}
        </button>
        {message ? (
          <span className="text-sm text-[color:var(--ventia-muted)]">
            {message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
