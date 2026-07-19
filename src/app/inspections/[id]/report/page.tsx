import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { formatLevel, formatStatus } from "@/lib/inspection";

export const dynamic = "force-dynamic";

/** Printable HTML stand-in for PDF report output (e.g. SN2656 Forsyth Rd style). */
export default async function InspectionReportPage({
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/inspections/${inspection.id}`} className="text-sm text-teal-300 hover:underline">
          ← Back to inspection
        </Link>
        <p className="text-xs text-slate-400">Print / Save as PDF from the browser (Ctrl+P)</p>
      </div>

      <article className="rounded-xl border border-slate-700 bg-white p-8 text-slate-900 shadow-lg print:border-0 print:shadow-none">
        <header className="border-b border-slate-300 pb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            VenInspect · Inspection Report
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {inspection.asset.assetNumber} — {inspection.asset.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {inspection.asset.type} · {inspection.asset.roadName ?? "—"} ·{" "}
            {inspection.asset.location ?? "—"}
          </p>
        </header>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Inspection level</dt>
            <dd className="font-medium">{formatLevel(inspection.level)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Status</dt>
            <dd className="font-medium">{formatStatus(inspection.status)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Inspected</dt>
            <dd className="font-medium">{format(inspection.inspectedAt, "dd MMM yyyy")}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Inspector</dt>
            <dd className="font-medium">{inspection.createdBy.name}</dd>
          </div>
          {inspection.approvedBy && (
            <div>
              <dt className="text-slate-500">Approved by</dt>
              <dd className="font-medium">{inspection.approvedBy.name}</dd>
            </div>
          )}
        </dl>

        {inspection.generalComments && (
          <section className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
              General comments
            </h2>
            <p className="mt-2 text-sm leading-relaxed">{inspection.generalComments}</p>
          </section>
        )}

        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
            Element comments
          </h2>
          <table className="mt-2 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-slate-500">
                <th className="py-2 pr-2 font-medium">Category</th>
                <th className="py-2 pr-2 font-medium">Subcategory</th>
                <th className="py-2 font-medium">Comments</th>
              </tr>
            </thead>
            <tbody>
              {inspection.categories.map((c) => (
                <tr key={c.id} className="border-b border-slate-200 align-top">
                  <td className="py-2 pr-2">{c.category}</td>
                  <td className="py-2 pr-2">{c.subcategory}</td>
                  <td className="py-2">{c.comments || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
            Defects
          </h2>
          {inspection.defects.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No defects recorded.</p>
          ) : (
            <ul className="mt-3 space-y-4">
              {inspection.defects.map((d) => (
                <li key={d.id} className="rounded border border-slate-200 p-3">
                  <p className="font-mono text-sm font-bold">{d.defectCode}</p>
                  <p className="mt-1 text-sm">{d.description}</p>
                  {d.comments && <p className="mt-1 text-sm text-slate-600">{d.comments}</p>}
                  <p className="mt-1 text-xs text-slate-500">
                    Severity: {d.severity}
                    {d.category ? ` · ${d.category}` : ""}
                    {d.subcategory ? ` / ${d.subcategory}` : ""}
                  </p>
                  {d.photoPath && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/uploads/${d.photoPath.split(/[/\\]/).map(encodeURIComponent).join("/")}`}
                      alt={d.defectCode}
                      className="mt-2 max-h-48 rounded border border-slate-200 object-contain"
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-8 border-t border-slate-300 pt-3 text-xs text-slate-500">
          Generated by VenInspect · placeholder for formal PDF export matching council /
          SN-style report templates.
        </footer>
      </article>
    </div>
  );
}
