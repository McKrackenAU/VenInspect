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

  if (field.type === "component_table") {
    let rows: {
      id?: string;
      name?: string;
      qty?: string;
      unit?: string;
      cs1?: string;
      cs2?: string;
      cs3?: string;
      cs4?: string;
      notes?: string;
    }[] = [];
    try {
      rows = value ? (JSON.parse(value) as typeof rows) : [];
    } catch {
      rows = [];
    }
    if (!Array.isArray(rows)) rows = [];
    return (
      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-[color:var(--ventia-muted)]">
            No components on this asset yet. An admin can add them under Manage → Assets.
          </p>
        ) : (
          rows.map((row, i) => (
            <div
              key={row.id ?? i}
              className="space-y-2 rounded-lg border border-[color:var(--ventia-border)] p-3"
            >
              <p className="text-sm font-semibold">{row.name || `Component ${i + 1}`}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block text-xs">
                  Qty
                  <input
                    className={common}
                    disabled={disabled}
                    value={row.qty ?? ""}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...row, qty: e.target.value };
                      onChange(JSON.stringify(next));
                    }}
                  />
                </label>
                <label className="block text-xs">
                  Unit
                  <input
                    className={common}
                    disabled={disabled}
                    value={row.unit ?? ""}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...row, unit: e.target.value };
                      onChange(JSON.stringify(next));
                    }}
                  />
                </label>
                <div className="grid grid-cols-4 gap-1 text-xs">
                  {(["cs1", "cs2", "cs3", "cs4"] as const).map((k) => (
                    <label key={k} className="block">
                      {k.toUpperCase()}
                      <input
                        className={common}
                        disabled={disabled}
                        value={row[k] ?? ""}
                        onChange={(e) => {
                          const next = [...rows];
                          next[i] = { ...row, [k]: e.target.value };
                          onChange(JSON.stringify(next));
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>
              <textarea
                className={`${common} min-h-[3rem]`}
                rows={2}
                disabled={disabled}
                placeholder="Notes…"
                value={row.notes ?? ""}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...row, notes: e.target.value };
                  onChange(JSON.stringify(next));
                }}
              />
            </div>
          ))
        )}
      </div>
    );
  }

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
  assetType = "BRIDGE",
  defectsSlot,
  photosSlot,
}: {
  inspectionId: string;
  template: InspectionTemplate;
  initialPayload: FormPayload;
  editable: boolean;
  /** Current asset type code — gates sections with assetTypes */
  assetType?: string;
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

  const visiblePages = useMemo(() => template.pages, [template.pages]);

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

  function isSectionOpen(section: TemplateSection): boolean {
    if (payload.openSections.includes(`!${section.id}`)) return false;
    if (payload.openSections.includes(section.id)) return true;
    if (sectionFilledCount(section, payload.values) > 0) return true;
    if (section.collapsedByDefault === false) return true;
    return false;
  }

  function sectionAllowed(section: TemplateSection) {
    if (!section.assetTypes || section.assetTypes.length === 0) return true;
    return section.assetTypes.includes(assetType);
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
          {activePage.sections.filter(sectionAllowed).length === 0 ? (
            <p className="text-sm text-[color:var(--ventia-muted)]">
              No sections on this page for this asset type.
            </p>
          ) : (
            activePage.sections.filter(sectionAllowed).map((sec) => (
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
