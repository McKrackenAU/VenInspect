"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  resetInspectionTemplateAction,
  saveInspectionTemplateAction,
} from "@/lib/actions";
import {
  DEFAULT_OUTCOME_OPTIONS,
  type FieldType,
  type InspectionTemplate,
  type TemplateField,
  type TemplatePage,
  type TemplateSection,
} from "@/lib/inspection-template-types";

const FIELD_TYPES: FieldType[] = [
  "outcome",
  "text",
  "textarea",
  "number",
  "select",
  "yesno",
  "date",
  "checkbox",
  "component_table",
  "component_notes",
  "measurement_list",
];

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function TemplateEditor({
  initial,
}: {
  initial: InspectionTemplate;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [template, setTemplate] = useState<InspectionTemplate>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePageId, setActivePageId] = useState(initial.pages[0]?.id ?? "");

  const activePage = useMemo(
    () => template.pages.find((p) => p.id === activePageId) ?? template.pages[0],
    [template.pages, activePageId],
  );

  function updatePage(pageId: string, patch: Partial<TemplatePage>) {
    setTemplate((t) => ({
      ...t,
      pages: t.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)),
    }));
  }

  function updateSection(
    pageId: string,
    sectionId: string,
    patch: Partial<TemplateSection>,
  ) {
    setTemplate((t) => ({
      ...t,
      pages: t.pages.map((p) =>
        p.id !== pageId
          ? p
          : {
              ...p,
              sections: p.sections.map((s) =>
                s.id === sectionId ? { ...s, ...patch } : s,
              ),
            },
      ),
    }));
  }

  function updateField(
    pageId: string,
    sectionId: string,
    fieldId: string,
    patch: Partial<TemplateField>,
  ) {
    setTemplate((t) => ({
      ...t,
      pages: t.pages.map((p) =>
        p.id !== pageId
          ? p
          : {
              ...p,
              sections: p.sections.map((s) =>
                s.id !== sectionId
                  ? s
                  : {
                      ...s,
                      fields: s.fields.map((f) =>
                        f.id === fieldId ? { ...f, ...patch } : f,
                      ),
                    },
              ),
            },
      ),
    }));
  }

  function save() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("templateJson", JSON.stringify(template));
        await saveInspectionTemplateAction(fd);
        setMessage("Saved.");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  function resetSeed() {
    if (
      !window.confirm(
        "Reset this template to the built-in seed? Your custom pages/fields for this type will be replaced.",
      )
    ) {
      return;
    }
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("typeCode", template.typeCode);
        await resetInspectionTemplateAction(fd);
        window.location.reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Reset failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block space-y-1 text-sm">
          <span className="text-[color:var(--ventia-muted)]">Label</span>
          <input
            className="field-input"
            value={template.label}
            onChange={(e) =>
              setTemplate((t) => ({ ...t, label: e.target.value }))
            }
          />
        </label>
        <p className="pb-2 font-mono text-xs text-[color:var(--ventia-muted)]">
          {template.typeCode}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="btn-primary ml-auto"
        >
          {pending ? "Saving…" : "Save template"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={resetSeed}
          className="rounded-xl border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
        >
          Reset to seed
        </button>
      </div>

      {message ? (
        <p className="text-sm text-[color:var(--ventia-green)]">{message}</p>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2 border-b border-[color:var(--ventia-border)] pb-2">
        {template.pages.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActivePageId(p.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              activePage?.id === p.id
                ? "bg-[color:var(--ventia-green)] text-white"
                : "border border-[color:var(--ventia-border)]"
            }`}
          >
            {p.title}
            {p.optional ? " *" : ""}
          </button>
        ))}
        <button
          type="button"
          className="rounded-full border border-[color:var(--ventia-green)] px-2.5 text-lg font-bold text-[color:var(--ventia-green)]"
          title="Add page"
          onClick={() => {
            const id = newId("page");
            setTemplate((t) => ({
              ...t,
              pages: [
                ...t.pages,
                {
                  id,
                  title: "New page",
                  optional: true,
                  builtin: null,
                  sections: [],
                },
              ],
            }));
            setActivePageId(id);
          }}
        >
          +
        </button>
      </div>

      {activePage ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="text-[color:var(--ventia-muted)]">Page title</span>
              <input
                className="field-input"
                value={activePage.title}
                onChange={(e) =>
                  updatePage(activePage.id, { title: e.target.value })
                }
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-[color:var(--ventia-muted)]">Built-in</span>
              <select
                className="field-input"
                value={activePage.builtin ?? ""}
                onChange={(e) =>
                  updatePage(activePage.id, {
                    builtin:
                      e.target.value === "defects" || e.target.value === "photos"
                        ? e.target.value
                        : null,
                  })
                }
              >
                <option value="">None (form fields)</option>
                <option value="defects">Defects UI</option>
                <option value="photos">Photos / register</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(activePage.optional)}
                onChange={(e) =>
                  updatePage(activePage.id, { optional: e.target.checked })
                }
                className="accent-[color:var(--ventia-green)]"
              />
              Optional page (inspector enables with +)
            </label>
            <button
              type="button"
              className="justify-self-start rounded-lg border border-rose-300 px-3 py-1.5 text-sm text-rose-700"
              onClick={() => {
                if (!window.confirm(`Remove page “${activePage.title}”?`)) return;
                setTemplate((t) => {
                  const pages = t.pages.filter((p) => p.id !== activePage.id);
                  setActivePageId(pages[0]?.id ?? "");
                  return { ...t, pages };
                });
              }}
            >
              Remove page
            </button>
          </div>

          {activePage.sections.map((sec) => (
            <div
              key={sec.id}
              className="space-y-3 rounded-xl border border-[color:var(--ventia-border)] p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="field-input max-w-md flex-1 font-semibold"
                  value={sec.title}
                  onChange={(e) =>
                    updateSection(activePage.id, sec.id, {
                      title: e.target.value,
                    })
                  }
                />
                <button
                  type="button"
                  className="rounded-full border border-rose-300 px-2 text-sm text-rose-700"
                  onClick={() => {
                    if (!window.confirm(`Remove section “${sec.title}”?`)) return;
                    updatePage(activePage.id, {
                      sections: activePage.sections.filter((s) => s.id !== sec.id),
                    });
                  }}
                >
                  − section
                </button>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-[color:var(--ventia-muted)]">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="accent-[color:var(--ventia-green)]"
                    checked={Boolean(sec.allowPhotos)}
                    onChange={(e) =>
                      updateSection(activePage.id, sec.id, {
                        allowPhotos: e.target.checked || undefined,
                        includePhotosInReport: e.target.checked
                          ? sec.includePhotosInReport !== false
                          : undefined,
                      })
                    }
                  />
                  Allow photos
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="accent-[color:var(--ventia-green)]"
                    checked={Boolean(sec.allowRaiseDefect)}
                    onChange={(e) =>
                      updateSection(activePage.id, sec.id, {
                        allowRaiseDefect: e.target.checked || undefined,
                      })
                    }
                  />
                  Allow raise defect
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="accent-[color:var(--ventia-green)]"
                    checked={sec.includePhotosInReport !== false && Boolean(sec.allowPhotos)}
                    disabled={!sec.allowPhotos}
                    onChange={(e) =>
                      updateSection(activePage.id, sec.id, {
                        includePhotosInReport: e.target.checked,
                      })
                    }
                  />
                  Include photos in report
                </label>
                <label className="inline-flex items-center gap-1.5">
                  Asset types
                  <input
                    className="field-input w-40 py-1 text-xs"
                    placeholder="BRIDGE,DRAINAGE"
                    value={(sec.assetTypes ?? []).join(",")}
                    onChange={(e) => {
                      const assetTypes = e.target.value
                        .split(",")
                        .map((s) => s.trim().toUpperCase())
                        .filter(Boolean);
                      updateSection(activePage.id, sec.id, {
                        assetTypes: assetTypes.length ? assetTypes : undefined,
                      });
                    }}
                  />
                </label>
              </div>

              <ul className="space-y-2">
                {sec.fields.map((f) => (
                  <li
                    key={f.id}
                    className="grid gap-2 rounded-lg border border-[color:var(--ventia-border)] p-3 sm:grid-cols-[1fr_8rem_auto]"
                  >
                    <input
                      className="field-input"
                      value={f.label}
                      onChange={(e) =>
                        updateField(activePage.id, sec.id, f.id, {
                          label: e.target.value,
                        })
                      }
                      placeholder="Field label"
                    />
                    <select
                      className="field-input"
                      value={f.type}
                      onChange={(e) => {
                        const type = e.target.value as FieldType;
                        updateField(activePage.id, sec.id, f.id, {
                          type,
                          options:
                            type === "outcome"
                              ? [...DEFAULT_OUTCOME_OPTIONS]
                              : type === "select"
                                ? f.options?.length
                                  ? f.options
                                  : ["Option A", "Option B"]
                                : undefined,
                        });
                      }}
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="rounded-full border border-rose-300 px-2 text-rose-700"
                      onClick={() =>
                        updateSection(activePage.id, sec.id, {
                          fields: sec.fields.filter((x) => x.id !== f.id),
                        })
                      }
                    >
                      −
                    </button>
                    {(f.type === "select" || f.type === "outcome") && (
                      <textarea
                        className="field-input sm:col-span-3"
                        rows={2}
                        value={(f.options ?? []).join("\n")}
                        onChange={(e) =>
                          updateField(activePage.id, sec.id, f.id, {
                            options: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="One option per line"
                      />
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-[color:var(--ventia-muted)] sm:col-span-3">
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          className="accent-[color:var(--ventia-green)]"
                          checked={Boolean(f.allowPhotos)}
                          onChange={(e) =>
                            updateField(activePage.id, sec.id, f.id, {
                              allowPhotos: e.target.checked || undefined,
                              includePhotosInReport: e.target.checked
                                ? f.includePhotosInReport !== false
                                : undefined,
                            })
                          }
                        />
                        Photos
                      </label>
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          className="accent-[color:var(--ventia-green)]"
                          checked={Boolean(f.allowRaiseDefect)}
                          onChange={(e) =>
                            updateField(activePage.id, sec.id, f.id, {
                              allowRaiseDefect: e.target.checked || undefined,
                            })
                          }
                        />
                        Raise defect
                      </label>
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          className="accent-[color:var(--ventia-green)]"
                          checked={
                            f.includePhotosInReport !== false && Boolean(f.allowPhotos)
                          }
                          disabled={!f.allowPhotos}
                          onChange={(e) =>
                            updateField(activePage.id, sec.id, f.id, {
                              includePhotosInReport: e.target.checked,
                            })
                          }
                        />
                        In report
                      </label>
                    </div>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className="rounded-lg border border-[color:var(--ventia-green)] px-3 py-1.5 text-sm font-semibold text-[color:var(--ventia-green)]"
                onClick={() =>
                  updateSection(activePage.id, sec.id, {
                    fields: [
                      ...sec.fields,
                      {
                        id: newId("field"),
                        label: "New field",
                        type: "textarea",
                      },
                    ],
                  })
                }
              >
                + field
              </button>
            </div>
          ))}

          {!activePage.builtin ? (
            <button
              type="button"
              className="rounded-lg bg-[color:var(--ventia-green-tint)] px-3 py-2 text-sm font-semibold text-[color:var(--ventia-green)]"
              onClick={() =>
                updatePage(activePage.id, {
                  sections: [
                    ...activePage.sections,
                    {
                      id: newId("sec"),
                      title: "New section",
                      collapsedByDefault: true,
                      fields: [],
                    },
                  ],
                })
              }
            >
              + section
            </button>
          ) : (
            <p className="text-sm text-[color:var(--ventia-muted)]">
              Built-in pages use the defects/photos UI. You can still add register
              note sections on Photos.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
