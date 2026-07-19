import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { addDefect, updateCategoryComment } from "@/lib/actions";
import { formatLevel, formatStatus } from "@/lib/inspection";

export const dynamic = "force-dynamic";

export default async function InspectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: {
      asset: true,
      createdBy: true,
      approvedBy: true,
      categories: { orderBy: [{ category: "asc" }, { subcategory: "asc" }] },
      defects: { orderBy: { defectCode: "asc" } },
    },
  });
  if (!inspection) notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">
            <Link href={`/assets/${inspection.assetId}`} className="hover:text-teal-300">
              {inspection.asset.assetNumber}
            </Link>{" "}
            / inspection
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            {formatLevel(inspection.level)} · {inspection.asset.name}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {format(inspection.inspectedAt, "dd MMM yyyy HH:mm")} ·{" "}
            {formatStatus(inspection.status)} · by {inspection.createdBy.name}
            {inspection.requiresLevel2Approval ? " · awaiting L2 verification" : ""}
          </p>
        </div>
        <Link
          href={`/inspections/${inspection.id}/report`}
          className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-teal-600 hover:text-teal-200"
        >
          Report preview
        </Link>
      </div>

      {inspection.generalComments && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-medium text-slate-300">General comments</h2>
          <p className="mt-1 text-sm text-slate-200">{inspection.generalComments}</p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">Category comments</h2>
        <ul className="space-y-3">
          {inspection.categories.map((cat) => (
            <li key={cat.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-sm font-medium text-teal-200">
                {cat.category} · {cat.subcategory}
              </p>
              <form action={updateCategoryComment} className="mt-2 space-y-2">
                <input type="hidden" name="id" value={cat.id} />
                <textarea
                  name="comments"
                  rows={2}
                  defaultValue={cat.comments ?? ""}
                  placeholder="Notes for this subcategory…"
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                />
                <button
                  type="submit"
                  className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600"
                >
                  Save
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-white">Defects</h2>
        {inspection.defects.length === 0 ? (
          <p className="text-sm text-slate-400">
            No defects yet. Photo is required — stored compressed as WebP on the data volume.
          </p>
        ) : (
          <ul className="space-y-2">
            {inspection.defects.map((d) => (
              <li
                key={d.id}
                className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3"
              >
                <div className="flex flex-wrap gap-4">
                  {d.photoPath && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/uploads/${d.photoPath.split(/[/\\]/).map(encodeURIComponent).join("/")}`}
                      alt={d.defectCode}
                      className="h-24 w-32 rounded-md object-cover ring-1 ring-slate-700"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-mono text-sm font-semibold text-amber-200">
                        {d.defectCode}
                      </span>
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        {d.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-100">{d.description}</p>
                    {d.comments && (
                      <p className="mt-1 text-sm text-slate-400">{d.comments}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {[d.category, d.subcategory].filter(Boolean).join(" · ") ||
                        "Uncategorised"}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form
          action={addDefect}
          encType="multipart/form-data"
          className="space-y-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-4"
        >
          <h3 className="text-sm font-medium text-slate-200">Add defect</h3>
          <input type="hidden" name="inspectionId" value={inspection.id} />
          <input
            name="description"
            required
            placeholder="Defect description *"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <textarea
            name="comments"
            rows={2}
            placeholder="Comments"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              name="category"
              placeholder="Category"
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <input
              name="subcategory"
              placeholder="Subcategory"
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              name="severity"
              defaultValue="MEDIUM"
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <label className="block space-y-1 text-xs text-slate-400">
              Photo * (compressed to WebP ≤1600px)
              <input
                name="photo"
                type="file"
                accept="image/*"
                capture="environment"
                required
                className="mt-1 block w-full text-sm text-slate-200"
              />
            </label>
          </div>
          <button
            type="submit"
            className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
          >
            Add defect (auto ID)
          </button>
        </form>
      </section>
    </div>
  );
}
