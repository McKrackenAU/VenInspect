"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fieldFilled,
  sectionFilledCount,
  type FormPayload,
  type InspectionTemplate,
  type TemplateField,
  type TemplatePage,
  type TemplateSection,
} from "@/lib/inspection-template-types";

type SaveState = "idle" | "saving" | "saved" | "error";

function FieldInput({
  field,
  value,
  disabled,
  onChange,
}: {
  field: TemplateField;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const common =
    "field-input w-full disabled:opacity-60";

  if (field.type === "textarea") {
    return (
      <textarea
        className={`${common} min-h-[4.5rem]`}
        rows={3}
        value={value}
        disabled={disabled}
        placeholder={field.hint || "Notes…"}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field.type === "outcome" || field.type === "select") {
    const opts = field.options?.length ? field.options : [];
    return (
      <select
        className={common}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— Select —</option>
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "yesno") {
    return (
      <select
        className={common}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
        <option value="N/A">N/A</option>
      </select>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[color:var(--ventia-green)]"
          checked={value === "true" || value === "Yes"}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked ? "Yes" : "")}
        />
        {field.hint || "Yes"}
      </label>
    );
  }

  return (
    <input
      type={
        field.type === "number"
          ? "number"
          : field.type === "date"
            ? "date"
            : "text"
      }
      className={common}
      value={value}
      disabled={disabled}
      placeholder={field.hint}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function SectionBlock({
  section,
  open,
  values,
  editable,
  onToggle,
  onChange,
}: {
  section: TemplateSection;
  open: boolean;
  values: Record<string, string>;
  editable: boolean;
  onToggle: (open: boolean) => void;
  onChange: (fieldId: string, value: string) => void;
}) {
  const filled = sectionFilledCount(section, values);
  const total = section.fields.length;

  return (
    <div className="rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)]">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <p className="font-semibold text-[color:var(--ventia-green)]">
            {section.title}
          </p>
          <p className="text-xs text-[color:var(--ventia-muted)]">
            {filled} of {total} filled
          </p>
        </div>
        {editable ? (
          <button
            type="button"
            onClick={() => onToggle(!open)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--ventia-green)] text-xl font-bold leading-none text-[color:var(--ventia-green)] hover:bg-[color:var(--ventia-green-tint)]"
            aria-label={open ? `Collapse ${section.title}` : `Open ${section.title}`}
            title={open ? "Collapse" : "Open section"}
          >
            {open ? "−" : "+"}
          </button>
        ) : open ? null : (
          <span className="text-xs text-[color:var(--ventia-muted)]">Closed</span>
        )}
      </div>

      {open ? (
        <ul className="space-y-3 border-t border-[color:var(--ventia-border)] px-4 py-3">
          {section.fields.map((field) => (
            <li key={field.id} className="space-y-1">
              <label className="block text-sm font-medium text-[color:var(--ventia-ink)]">
                {field.label}
              </label>
              {editable ? (
                <FieldInput
                  field={field}
                  value={values[field.id] ?? ""}
                  disabled={false}
                  onChange={(v) => onChange(field.id, v)}
                />
              ) : (
                <p className="text-sm text-[color:var(--ventia-muted)]">
                  {values[field.id]?.trim() || "—"}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function InspectionDraftWorkspace({
  inspectionId,
  template,
  initialPayload,
  editable,
  defectsSlot,
  photosSlot,
}: {
  inspectionId: string;
  template: InspectionTemplate;
  initialPayload: FormPayload;
  editable: boolean;
  defectsSlot?: React.ReactNode;
  photosSlot?: React.ReactNode;
}) {
  const [payload, setPayload] = useState<FormPayload>(initialPayload);
  const [pageId, setPageId] = useState(() => {
    const firstRequired = template.pages.find((p) => !p.optional) ?? template.pages[0];
    return firstRequired?.id ?? "";
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(payload);
  latest.current = payload;

  const visiblePages = useMemo(() => {
    return template.pages.filter(
      (p) =>
        !p.optional ||
        payload.enabledOptionalPages.includes(p.id) ||
        p.id === pageId,
    );
  }, [template.pages, payload.enabledOptionalPages, pageId]);

  const optionalClosed = useMemo(
    () =>
      template.pages.filter(
        (p) => p.optional && !payload.enabledOptionalPages.includes(p.id),
      ),
    [template.pages, payload.enabledOptionalPages],
  );

  const activePage: TemplatePage | undefined =
    template.pages.find((p) => p.id === pageId) ?? visiblePages[0];

  const persist = useCallback(
    async (next: FormPayload) => {
      if (!editable) return;
      setSaveState("saving");
      setSaveError(null);
      try {
        const res = await fetch(`/api/inspections/${inspectionId}/form`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (!res.ok) throw new Error(body?.error || `Save failed (${res.status})`);
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
        setSaveError(e instanceof Error ? e.message : "Save failed");
      }
    },
    [editable, inspectionId],
  );

  const scheduleSave = useCallback(
    (next: FormPayload) => {
      setPayload(next);
      if (!editable) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void persist(next);
      }, 600);
    },
    [editable, persist],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function setValue(fieldId: string, value: string) {
    scheduleSave({
      ...latest.current,
      values: { ...latest.current.values, [fieldId]: value },
    });
  }

  function toggleSection(sectionId: string, open: boolean) {
    const set = new Set(latest.current.openSections);
    set.delete(sectionId);
    set.delete(`!${sectionId}`);
    if (open) set.add(sectionId);
    else set.add(`!${sectionId}`);
    scheduleSave({
      ...latest.current,
      openSections: [...set],
    });
  }

  function enableOptionalPage(p: TemplatePage) {
    const set = new Set(latest.current.enabledOptionalPages);
    set.add(p.id);
    const open = new Set(latest.current.openSections);
    if (p.sections[0]) {
      open.delete(`!${p.sections[0].id}`);
      open.add(p.sections[0].id);
    }
    const next = {
      ...latest.current,
      enabledOptionalPages: [...set],
      openSections: [...open],
    };
    scheduleSave(next);
    setPageId(p.id);
  }

  function isSectionOpen(section: TemplateSection): boolean {
    if (payload.openSections.includes(`!${section.id}`)) return false;
    if (payload.openSections.includes(section.id)) return true;
    if (sectionFilledCount(section, payload.values) > 0) return true;
    if (section.collapsedByDefault === false) return true;
    return false;
  }

  return (
    <div className="space-y-4">
      <div className="no-print sticky top-0 z-20 -mx-1 space-y-2 bg-[color:var(--background)]/95 px-1 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          {visiblePages.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPageId(p.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                activePage?.id === p.id
                  ? "bg-[color:var(--ventia-green)] text-white"
                  : "border border-[color:var(--ventia-border)] text-[color:var(--ventia-ink)]"
              }`}
            >
              {p.title}
            </button>
          ))}
          {editable && optionalClosed.length > 0 ? (
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-full border border-[color:var(--ventia-green)] px-2.5 py-1 text-lg font-bold leading-none text-[color:var(--ventia-green)]">
                +
              </summary>
              <div className="absolute left-0 z-30 mt-1 min-w-[12rem] rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-2 shadow-lg">
                <p className="px-2 pb-1 text-xs text-[color:var(--ventia-muted)]">
                  Add page
                </p>
                {optionalClosed.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[color:var(--ventia-green-tint)]"
                    onClick={() => enableOptionalPage(p)}
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            </details>
          ) : null}
          <span className="ml-auto text-xs text-[color:var(--ventia-muted)]">
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved"
                : saveState === "error"
                  ? saveError || "Save error"
                  : editable
                    ? "Draft autosaves"
                    : "Read only"}
          </span>
        </div>
      </div>

      {activePage?.builtin === "defects" ? (
        <div className="space-y-3">{defectsSlot}</div>
      ) : null}

      {activePage?.builtin === "photos" ? (
        <div className="space-y-3">
          {photosSlot}
          {activePage.sections.map((sec) => (
            <SectionBlock
              key={sec.id}
              section={sec}
              open={isSectionOpen(sec)}
              values={payload.values}
              editable={editable}
              onToggle={(open) => toggleSection(sec.id, open)}
              onChange={setValue}
            />
          ))}
        </div>
      ) : null}

      {activePage && !activePage.builtin ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[color:var(--ventia-green)]">
            {activePage.title}
          </h2>
          {activePage.sections.length === 0 ? (
            <p className="text-sm text-[color:var(--ventia-muted)]">
              No sections on this page yet. An admin can add them under Inspection
              templates.
            </p>
          ) : (
            activePage.sections.map((sec) => (
              <SectionBlock
                key={sec.id}
                section={sec}
                open={isSectionOpen(sec)}
                values={payload.values}
                editable={editable}
                onToggle={(open) => toggleSection(sec.id, open)}
                onChange={setValue}
              />
            ))
          )}
        </div>
      ) : null}

      {/* Hidden helper: show filled-field summary for closed optional awareness */}
      {!editable &&
      activePage &&
      !activePage.builtin &&
      Object.keys(payload.values).some(fieldFilled) ? null : null}
    </div>
  );
}
