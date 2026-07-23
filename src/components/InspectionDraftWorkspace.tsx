"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { addAssetComponentFromInspectionAction } from "@/lib/actions";
import { SectionMediaPanel } from "@/components/SectionMediaPanel";
import {
  defaultMeasurementRows,
  fieldFilled,
  mediaKey,
  parseComponentNotes,
  parseMeasurementList,
  sectionFilledCount,
  type ComponentNotesRow,
  type FormMediaItem,
  type FormPayload,
  type InspectionTemplate,
  type MeasurementListRow,
  type TemplateField,
  type TemplatePage,
  type TemplateSection,
} from "@/lib/inspection-template-types";

type SaveState = "idle" | "saving" | "saved" | "error";

type CrRow = {
  id?: string;
  name?: string;
  category?: string;
  qty?: string;
  unit?: string;
  cs1?: string;
  cs2?: string;
  cs3?: string;
  cs4?: string;
  notes?: string;
};

function MeasurementListInput({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const rows: MeasurementListRow[] =
    parseMeasurementList(value).length > 0
      ? parseMeasurementList(value)
      : defaultMeasurementRows(5);

  function commit(next: MeasurementListRow[]) {
    onChange(JSON.stringify(next));
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={row.id} className="flex flex-wrap items-end gap-2">
          <label className="min-w-[8rem] flex-1 space-y-1 text-xs">
            <span className="text-[color:var(--ventia-muted)]">
              {row.label || `Measurement ${i + 1}`}
            </span>
            <input
              type="number"
              step="any"
              className="field-input w-full disabled:opacity-60"
              disabled={disabled}
              value={row.value}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, value: e.target.value };
                commit(next);
              }}
            />
          </label>
          {!disabled ? (
            <button
              type="button"
              className="rounded-full border border-rose-300 px-2 py-1 text-xs text-rose-700"
              title="Remove if blank"
              onClick={() => {
                if (row.value.trim() && !window.confirm("Remove this measurement?")) {
                  return;
                }
                commit(rows.filter((_, idx) => idx !== i));
              }}
            >
              −
            </button>
          ) : null}
        </div>
      ))}
      {!disabled ? (
        <button
          type="button"
          className="rounded-lg border border-[color:var(--ventia-green)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ventia-green)]"
          onClick={() =>
            commit([
              ...rows,
              {
                id: `m${Date.now().toString(36)}`,
                label: `Measurement ${rows.length + 1}`,
                value: "",
              },
            ])
          }
        >
          + Add measurement
        </button>
      ) : null}
    </div>
  );
}

function ComponentNotesInput({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const rows = parseComponentNotes(value);

  function commit(next: ComponentNotesRow[]) {
    onChange(JSON.stringify(next));
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-sm text-[color:var(--ventia-muted)]">No parts yet.</p>
      ) : (
        rows.map((row, i) => (
          <div
            key={row.id}
            className="space-y-1 rounded-lg border border-[color:var(--ventia-border)] p-3"
          >
            <div className="flex items-center gap-2">
              {disabled ? (
                <p className="text-sm font-semibold">{row.label}</p>
              ) : (
                <input
                  className="field-input flex-1 text-sm font-semibold"
                  value={row.label}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...row, label: e.target.value };
                    commit(next);
                  }}
                  placeholder="Part name"
                />
              )}
              {!disabled ? (
                <button
                  type="button"
                  className="rounded-full border border-rose-300 px-2 text-xs text-rose-700"
                  onClick={() => {
                    if (
                      row.notes.trim() &&
                      !window.confirm(`Remove “${row.label || "part"}”?`)
                    ) {
                      return;
                    }
                    commit(rows.filter((_, idx) => idx !== i));
                  }}
                >
                  −
                </button>
              ) : null}
            </div>
            {disabled ? (
              <p className="text-sm text-[color:var(--ventia-muted)]">
                {row.notes.trim() || "—"}
              </p>
            ) : (
              <textarea
                className="field-input min-h-[3rem] w-full"
                rows={2}
                placeholder="Notes…"
                value={row.notes}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...row, notes: e.target.value };
                  commit(next);
                }}
              />
            )}
          </div>
        ))
      )}
      {!disabled ? (
        <button
          type="button"
          className="rounded-lg border border-[color:var(--ventia-green)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ventia-green)]"
          onClick={() => {
            const label = window.prompt("New part name");
            if (!label?.trim()) return;
            commit([
              ...rows,
              {
                id: `part_${Date.now().toString(36)}`,
                label: label.trim(),
                notes: "",
              },
            ]);
          }}
        >
          + Add part
        </button>
      ) : null}
    </div>
  );
}

function ComponentTableInput({
  inspectionId,
  value,
  disabled,
  onChange,
}: {
  inspectionId: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [error, setError] = useState<string | null>(null);

  let rows: CrRow[] = [];
  try {
    rows = value ? (JSON.parse(value) as CrRow[]) : [];
  } catch {
    rows = [];
  }
  if (!Array.isArray(rows)) rows = [];

  const common = "field-input w-full disabled:opacity-60";

  function commit(next: CrRow[]) {
    onChange(JSON.stringify(next));
  }

  function addComponent() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("inspectionId", inspectionId);
        fd.set("name", trimmed);
        fd.set("category", category.trim());
        fd.set("qty", qty.trim());
        fd.set("unit", unit.trim());
        const created = await addAssetComponentFromInspectionAction(fd);
        commit([
          ...rows,
          {
            id: created.id,
            name: created.name,
            category: created.category,
            qty: created.qty,
            unit: created.unit,
            cs1: "",
            cs2: "",
            cs3: "",
            cs4: "",
            notes: "",
          },
        ]);
        setName("");
        setCategory("");
        setQty("");
        setUnit("");
        setAdding(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add component");
      }
    });
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-sm text-[color:var(--ventia-muted)]">
          No components yet. Add one below, or ask an admin to set up the register under
          Manage → Assets.
        </p>
      ) : (
        rows.map((row, i) => (
          <div
            key={row.id ?? i}
            className="space-y-2 rounded-lg border border-[color:var(--ventia-border)] p-3"
          >
            <p className="text-sm font-semibold">
              {row.name || `Component ${i + 1}`}
              {row.category ? (
                <span className="ml-2 text-xs font-normal text-[color:var(--ventia-muted)]">
                  {row.category}
                </span>
              ) : null}
            </p>
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
                    commit(next);
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
                    commit(next);
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
                        commit(next);
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
                commit(next);
              }}
            />
          </div>
        ))
      )}

      {!disabled ? (
        adding ? (
          <div className="space-y-2 rounded-xl border border-[color:var(--ventia-green)] bg-[color:var(--ventia-green-tint)]/30 p-3">
            <p className="text-sm font-semibold text-[color:var(--ventia-green)]">
              Add component
            </p>
            <input
              className="field-input w-full"
              placeholder="Name (required)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                className="field-input"
                placeholder="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <input
                className="field-input"
                placeholder="Qty"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
              <input
                className="field-input"
                placeholder="Unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || !name.trim()}
                className="btn-primary text-xs"
                onClick={addComponent}
              >
                {pending ? "Saving…" : "Add to register & form"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-1.5 text-xs"
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
            </div>
            {error ? <p className="text-xs text-rose-600">{error}</p> : null}
          </div>
        ) : (
          <button
            type="button"
            className="rounded-lg border border-[color:var(--ventia-green)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ventia-green)]"
            onClick={() => setAdding(true)}
          >
            + Add component
          </button>
        )
      ) : null}
    </div>
  );
}

function FieldInput({
  field,
  value,
  disabled,
  inspectionId,
  onChange,
}: {
  field: TemplateField;
  value: string;
  disabled: boolean;
  inspectionId: string;
  onChange: (v: string) => void;
}) {
  const common = "field-input w-full disabled:opacity-60";

  if (field.type === "component_table") {
    return (
      <ComponentTableInput
        inspectionId={inspectionId}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  if (field.type === "measurement_list") {
    return (
      <MeasurementListInput value={value} disabled={disabled} onChange={onChange} />
    );
  }

  if (field.type === "component_notes") {
    return (
      <ComponentNotesInput value={value} disabled={disabled} onChange={onChange} />
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
  media,
  editable,
  inspectionId,
  onToggle,
  onChange,
  onMediaChange,
}: {
  section: TemplateSection;
  open: boolean;
  values: Record<string, string>;
  media: Record<string, FormMediaItem[]>;
  editable: boolean;
  inspectionId: string;
  onToggle: (open: boolean) => void;
  onChange: (fieldId: string, value: string) => void;
  onMediaChange: (key: string, items: FormMediaItem[]) => void;
}) {
  const filled = sectionFilledCount(section, values);
  const total = section.fields.length;
  const idPlateCondition = values.inv_id_plate_condition ?? "";
  const needsIdPlateDefect =
    section.id === "inv_ids" &&
    (idPlateCondition === "Damaged" || idPlateCondition === "Missing");

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
          {section.fields.map((field) => {
            const fieldMediaKey = mediaKey(section.id, field.id);
            const fieldItems = media[fieldMediaKey] ?? [];
            return (
              <li key={field.id} className="space-y-2">
                <label className="block text-sm font-medium text-[color:var(--ventia-ink)]">
                  {field.label}
                </label>
                {editable ? (
                  <FieldInput
                    field={field}
                    value={values[field.id] ?? ""}
                    disabled={false}
                    inspectionId={inspectionId}
                    onChange={(v) => onChange(field.id, v)}
                  />
                ) : (
                  <p className="text-sm text-[color:var(--ventia-muted)]">
                    {field.type === "measurement_list" ||
                    field.type === "component_notes" ||
                    field.type === "component_table"
                      ? values[field.id]?.trim()
                        ? "(see details)"
                        : "—"
                      : values[field.id]?.trim() || "—"}
                  </p>
                )}
                {field.hint && field.type === "select" ? (
                  <p className="text-xs text-[color:var(--ventia-muted)]">{field.hint}</p>
                ) : null}
                {field.allowPhotos ? (
                  <SectionMediaPanel
                    inspectionId={inspectionId}
                    sectionId={section.id}
                    fieldId={field.id}
                    label={field.label}
                    items={fieldItems}
                    editable={editable}
                    allowRaiseDefect={
                      Boolean(field.allowRaiseDefect) ||
                      (field.id === "inv_id_plate_condition" && needsIdPlateDefect)
                    }
                    defectDefaults={
                      field.id === "inv_id_plate_condition"
                        ? {
                            category: "Identification",
                            subcategory: "ID plate",
                            description: `ID plate ${idPlateCondition.toLowerCase()}`,
                            severity: "CS3",
                          }
                        : field.id === "inv_access_notes"
                          ? {
                              category: "Access",
                              subcategory: "Hazards",
                              description: values.inv_access_notes?.slice(0, 200),
                              severity: "CS2",
                            }
                          : {
                              category: section.title,
                              subcategory: field.label,
                            }
                    }
                    onMediaChange={(items) => onMediaChange(fieldMediaKey, items)}
                  />
                ) : null}
                {field.id === "inv_id_plate_condition" && needsIdPlateDefect && editable ? (
                  <p className="rounded-lg border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                    ID plate is {idPlateCondition.toLowerCase()}. Capture a photo above and
                    use &quot;Raise as defect&quot; so it appears on the Defects page and in
                    the report.
                  </p>
                ) : null}
              </li>
            );
          })}

          {section.allowPhotos ? (
            <li>
              <SectionMediaPanel
                inspectionId={inspectionId}
                sectionId={section.id}
                label={section.title}
                items={media[section.id] ?? []}
                editable={editable}
                allowRaiseDefect={Boolean(section.allowRaiseDefect)}
                defectDefaults={{
                  category: section.title,
                  subcategory: "Overview",
                }}
                onMediaChange={(items) => onMediaChange(section.id, items)}
              />
            </li>
          ) : null}
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
  const [payload, setPayload] = useState<FormPayload>(() => ({
    ...initialPayload,
    media: initialPayload.media ?? {},
  }));
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

  function setMedia(key: string, items: FormMediaItem[]) {
    const media = { ...(latest.current.media ?? {}) };
    if (items.length) media[key] = items;
    else delete media[key];
    // Media is already persisted by the form-media API; keep local state in sync
    setPayload({ ...latest.current, media });
    latest.current = { ...latest.current, media };
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
              media={payload.media ?? {}}
              editable={editable}
              inspectionId={inspectionId}
              onToggle={(open) => toggleSection(sec.id, open)}
              onChange={setValue}
              onMediaChange={setMedia}
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
                media={payload.media ?? {}}
                editable={editable}
                inspectionId={inspectionId}
                onToggle={(open) => toggleSection(sec.id, open)}
                onChange={setValue}
                onMediaChange={setMedia}
              />
            ))
          )}
        </div>
      ) : null}

      {!editable &&
      activePage &&
      !activePage.builtin &&
      Object.keys(payload.values).some(fieldFilled) ? null : null}
    </div>
  );
}
