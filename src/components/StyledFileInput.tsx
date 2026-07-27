"use client";

import { useId, useState } from "react";

/** Dark-theme file picker matching defect photo drop-zone style. */
export function StyledFileInput({
  name = "file",
  accept,
  required,
  label = "Choose file",
  hint,
}: {
  name?: string;
  accept?: string;
  required?: boolean;
  label?: string;
  hint?: string;
}) {
  const id = useId();
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[color:var(--ventia-border)] bg-[color:var(--panel)] px-4 py-5 text-center transition hover:border-[color:var(--ventia-green)] hover:bg-[color:var(--ventia-green-tint)]/20"
      >
        <span className="text-sm font-semibold text-[color:var(--ventia-green)]">
          {label}
        </span>
        <span className="text-xs text-[color:var(--ventia-muted)]">
          {fileName ?? hint ?? "No file chosen"}
        </span>
      </label>
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        required={required}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          setFileName(f?.name ?? null);
        }}
      />
    </div>
  );
}

export function TemplateDownloadButtons({
  kind,
}: {
  kind: "assets" | "audit" | "components";
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={`/api/manage/import-templates/${kind}?format=csv`}
        className="inline-flex items-center rounded-lg border border-[color:var(--ventia-border)] bg-[color:var(--panel)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ventia-ink)] hover:bg-[color:var(--ventia-green-tint)]"
      >
        Download CSV template
      </a>
      <a
        href={`/api/manage/import-templates/${kind}?format=xlsx`}
        className="inline-flex items-center rounded-lg border-2 border-[color:var(--ventia-green)] bg-[color:var(--panel)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ventia-green)] hover:bg-[color:var(--ventia-green-tint)]"
      >
        Download Excel template
      </a>
    </div>
  );
}
