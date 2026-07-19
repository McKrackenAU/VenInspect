import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { linkAsChildInspection, updateCategoryComment } from "@/lib/actions";
import { DefectAddForm } from "@/components/DefectAddForm";
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
      parent: true,
      children: true,
      categories: { orderBy: [{ category: "asc" }, { subcategory: "asc" }] },
      defects: { orderBy: { defectCode: "asc" } },
    },
  });
  if (!inspection) notFound();

  const siblings = await prisma.inspection.findMany({
    where: {
      assetId: inspection.assetId,
      id: { not: inspection.id },
      relationKind: { not: "CHILD" },
    },
    orderBy: { submittedAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[color:var(--ventia-muted)]">
            <Link
              href={`/assets/${inspection.assetId}`}
              className="hover:text-[color:var(--ventia-blue)]"
            >
              {inspection.asset.roadName} / {inspection.asset.assetNumber}
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[color:var(--ventia-green)]">
            {inspection.titleLabel}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
            {formatLevel(inspection.level)} · {formatStatus(inspection.status)} · submitted{" "}
            {format(inspection.submittedAt, "dd MMM yyyy HH:mm:ss")} · by{" "}
            {inspection.createdBy.name}
            {inspection.requiresLevel2Approval ? " · awaiting L2 verification" : ""}
            {" · folder "}
            <code className="text-xs">{inspection.folderKey}</code>
          </p>
          {inspection.parent && (
            <p className="mt-1 text-xs text-[color:var(--ventia-muted)]">
              Child of{" "}
              <Link
                href={`/inspections/${inspection.parent.id}`}
                className="text-[color:var(--ventia-blue)] hover:underline"
              >
                {inspection.parent.titleLabel}
              </Link>
            </p>
          )}
          {inspection.children.length > 0 && (
            <p className="mt-1 text-xs text-[color:var(--ventia-muted)]">
              Parent of:{" "}
              {inspection.children.map((c, i) => (
                <span key={c.id}>
                  {i > 0 ? ", " : ""}
                  <Link
                    href={`/inspections/${c.id}`}
                    className="text-[color:var(--ventia-blue)] hover:underline"
                  >
                    {c.titleLabel}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/inspections/${inspection.id}/report`}
            className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
          >
            Full report
          </Link>
          <Link
            href={`/inspections/${inspection.id}/scope`}
            className="rounded-md bg-[color:var(--ventia-green)] px-3 py-2 text-sm font-medium text-white"
          >
            Scope export
          </Link>
        </div>
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

        <DefectAddForm inspectionId={inspection.id} />
      </section>

      {siblings.length > 0 && inspection.relationKind !== "CHILD" && (
        <section className="rounded-xl border border-[color:var(--ventia-border)] bg-white p-4">
          <h2 className="text-sm font-medium">Link as child of another report</h2>
          <form action={linkAsChildInspection} className="mt-2 flex flex-wrap gap-2">
            <input type="hidden" name="childId" value={inspection.id} />
            <select
              name="parentId"
              required
              className="min-w-[16rem] flex-1 rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Parent inspection…
              </option>
              {siblings.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.titleLabel}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-[color:var(--ventia-blue)] px-3 py-2 text-sm font-medium text-white"
            >
              Link as child
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
