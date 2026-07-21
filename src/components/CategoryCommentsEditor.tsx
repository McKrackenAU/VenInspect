"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addInspectionCategory,
  removeInspectionCategory,
  updateCategoryComment,
} from "@/lib/actions";

export type CategoryRow = {
  id: string;
  category: string;
  subcategory: string;
  comments: string | null;
};

export type CatalogGroup = {
  category: string;
  subcategories: readonly string[];
};

type Props = {
  inspectionId: string;
  categories: CategoryRow[];
  catalog: CatalogGroup[];
  editable: boolean;
};

export function CategoryCommentsEditor({
  inspectionId,
  categories,
  catalog,
  editable,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [pickCategory, setPickCategory] = useState(catalog[0]?.category ?? "");
  const [pickSub, setPickSub] = useState(catalog[0]?.subcategories[0] ?? "");
  const [customCat, setCustomCat] = useState("");
  const [customSub, setCustomSub] = useState("");

  const subOptions = useMemo(() => {
    const group = catalog.find((c) => c.category === pickCategory);
    return group?.subcategories ?? [];
  }, [catalog, pickCategory]);

  function confirmRemove(row: CategoryRow) {
    const hasText = Boolean(row.comments?.trim());
    if (hasText) {
      const ok = window.confirm(
        "This section has notes. Removing it will permanently lose that text. Continue?",
      );
      if (!ok) return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", row.id);
      await removeInspectionCategory(fd);
      router.refresh();
    });
  }

  function addFromCatalog() {
    const category = customCat.trim() || pickCategory;
    const subcategory = customSub.trim() || pickSub;
    if (!category || !subcategory) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("inspectionId", inspectionId);
      fd.set("category", category);
      fd.set("subcategory", subcategory);
      await addInspectionCategory(fd);
      setAddOpen(false);
      setCustomCat("");
      setCustomSub("");
      router.refresh();
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[color:var(--ventia-green)]">
          Category comments
        </h2>
        {editable ? (
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--ventia-green)] text-xl font-bold leading-none text-[color:var(--ventia-green)] hover:bg-[color:var(--ventia-green-tint)]"
            aria-label="Add category section"
            title="Add category"
          >
            +
          </button>
        ) : null}
      </div>

      {addOpen && editable ? (
        <div className="card space-y-3 p-4">
          <p className="text-sm font-medium">Add a category section</p>
          {catalog.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="text-[color:var(--ventia-muted)]">Category</span>
                <select
                  value={pickCategory}
                  onChange={(e) => {
                    setPickCategory(e.target.value);
                    const next = catalog.find((c) => c.category === e.target.value);
                    setPickSub(next?.subcategories[0] ?? "");
                  }}
                  className="field-input"
                >
                  {catalog.map((g) => (
                    <option key={g.category} value={g.category}>
                      {g.category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-[color:var(--ventia-muted)]">Subcategory</span>
                <select
                  value={pickSub}
                  onChange={(e) => setPickSub(e.target.value)}
                  className="field-input"
                >
                  {subOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={customCat}
              onChange={(e) => setCustomCat(e.target.value)}
              placeholder="Or custom category…"
              className="field-input"
            />
            <input
              value={customSub}
              onChange={(e) => setCustomSub(e.target.value)}
              placeholder="Or custom subcategory…"
              className="field-input"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={addFromCatalog}
              className="rounded-lg bg-[color:var(--ventia-green)] px-3 py-2 text-sm font-semibold text-white"
            >
              Add section
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {categories.length === 0 ? (
        <p className="text-sm text-[color:var(--ventia-muted)]">
          No category sections yet. Use + to add one.
        </p>
      ) : (
        <ul className="space-y-3">
          {categories.map((cat) => (
            <li key={cat.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[color:var(--ventia-green-mid)]">
                  {cat.category} · {cat.subcategory}
                </p>
                {editable ? (
                  <button
                    type="button"
                    onClick={() => confirmRemove(cat)}
                    disabled={pending}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rose-300 text-lg font-bold leading-none text-rose-700 hover:bg-rose-50"
                    aria-label={`Remove ${cat.category} ${cat.subcategory}`}
                    title="Remove section"
                  >
                    −
                  </button>
                ) : null}
              </div>
              {editable ? (
                <form action={updateCategoryComment} className="mt-2 space-y-2">
                  <input type="hidden" name="id" value={cat.id} />
                  <textarea
                    name="comments"
                    rows={2}
                    defaultValue={cat.comments ?? ""}
                    placeholder="Notes for this subcategory…"
                    className="field-input min-h-[4rem]"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-[color:var(--ventia-green)] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Save
                  </button>
                </form>
              ) : (
                <p className="mt-2 text-sm text-[color:var(--ventia-ink)]">
                  {cat.comments?.trim() || "—"}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
