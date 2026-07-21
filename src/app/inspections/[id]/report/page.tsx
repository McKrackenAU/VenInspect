import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canViewInspection } from "@/lib/inspection-access";
import { formatLevel, formatStatus } from "@/lib/inspection";
import { severityLabel } from "@/lib/severities";
import { PrintButton } from "@/components/PrintButton";
import { VentiaPrintLogo } from "@/components/BrandMark";

export const dynamic = "force-dynamic";

function photoUrl(path: string) {
  return `/api/uploads/${path.split(/[/\\]/).map(encodeURIComponent).join("/")}`;
}

export default async function InspectionReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
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
  if (!canViewInspection(user, inspection)) redirect("/assets");

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/inspections/${inspection.id}`}
          className="text-sm text-[color:var(--ventia-blue)] hover:underline"
        >
          ← Back to inspection
        </Link>
        <div className="flex flex-wrap gap-2">
          <PrintButton label="Export PDF" />
          <Link
            href={`/inspections/${inspection.id}/scope`}
            className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm font-semibold text-[color:var(--ventia-green)]"
          >
            Scope export
          </Link>
        </div>
      </div>

      <article className="report-sheet mx-auto max-w-3xl rounded-xl border border-[color:var(--ventia-border)] bg-white p-8 text-slate-900 shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none">
        <header className="border-b-2 border-[color:var(--ventia-green)] pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                VenInspect · Inspection Report
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-[color:var(--ventia-green)]">
                {inspection.asset.assetNumber} — {inspection.asset.name}
              </h1>
            </div>
            <VentiaPrintLogo />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {inspection.asset.type} · {inspection.asset.roadName} ·{" "}
            {inspection.asset.location ?? "—"}
          </p>
        </header>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[color:var(--ventia-muted)]">Inspection level</dt>
            <dd className="font-medium">{formatLevel(inspection.level)}</dd>
          </div>
          <div>
            <dt className="text-[color:var(--ventia-muted)]">Status</dt>
            <dd className="font-medium">{formatStatus(inspection.status)}</dd>
          </div>
          <div>
            <dt className="text-[color:var(--ventia-muted)]">Inspected</dt>
            <dd className="font-medium">
              {format(inspection.inspectedAt, "dd MMM yyyy")}
            </dd>
          </div>
          <div>
            <dt className="text-[color:var(--ventia-muted)]">Inspector</dt>
            <dd className="font-medium">{inspection.createdBy.name}</dd>
          </div>
          {inspection.approvedBy ? (
            <div>
              <dt className="text-[color:var(--ventia-muted)]">Approved by</dt>
              <dd className="font-medium">{inspection.approvedBy.name}</dd>
            </div>
          ) : null}
        </dl>

        {inspection.generalComments ? (
          <section className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[color:var(--ventia-green)]">
              General comments
            </h2>
            <p className="mt-2 text-sm leading-relaxed">{inspection.generalComments}</p>
          </section>
        ) : null}

        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[color:var(--ventia-green)]">
            Element comments
          </h2>
          <table className="mt-2 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--ventia-border)] text-[color:var(--ventia-muted)]">
                <th className="py-2 pr-2 font-medium">Category</th>
                <th className="py-2 pr-2 font-medium">Subcategory</th>
                <th className="py-2 font-medium">Comments</th>
              </tr>
            </thead>
            <tbody>
              {inspection.categories.map((c) => (
                <tr key={c.id} className="border-b border-[color:var(--ventia-border)] align-top">
                  <td className="py-2 pr-2">{c.category}</td>
                  <td className="py-2 pr-2">{c.subcategory}</td>
                  <td className="py-2">{c.comments || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[color:var(--ventia-green)]">
            Defects
          </h2>
          {inspection.defects.length === 0 ? (
            <p className="mt-2 text-sm text-[color:var(--ventia-muted)]">
              No defects recorded.
            </p>
          ) : (
            <ul className="mt-3 space-y-4">
              {inspection.defects.map((d) => (
                <li
                  key={d.id}
                  className="break-inside-avoid rounded border border-[color:var(--ventia-border)] p-3"
                >
                  <p className="font-mono text-sm font-bold text-[color:var(--ventia-green)]">
                    {d.defectCode}
                  </p>
                  <p className="mt-1 text-sm">{d.description}</p>
                  {d.comments ? (
                    <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
                      {d.comments}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-[color:var(--ventia-muted)]">
                    Severity: {severityLabel(d.severity)}
                    {d.category ? ` · ${d.category}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {d.comparisonPhotoPath ? (
                      <div>
                        <p className="text-[0.65rem] uppercase text-[color:var(--ventia-muted)]">
                          Prior
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photoUrl(d.comparisonPhotoPath)}
                          alt="Prior"
                          className="mt-1 max-h-40 rounded border object-contain"
                        />
                      </div>
                    ) : null}
                    {d.photoPath ? (
                      <div>
                        {d.comparisonPhotoPath ? (
                          <p className="text-[0.65rem] uppercase text-[color:var(--ventia-muted)]">
                            Current
                          </p>
                        ) : null}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photoUrl(d.photoPath)}
                          alt={d.defectCode}
                          className="mt-1 max-h-40 rounded border object-contain"
                        />
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-8 border-t border-[color:var(--ventia-border)] pt-3 text-xs text-[color:var(--ventia-muted)]">
          Generated by VenInspect · {inspection.titleLabel}
        </footer>
      </article>
    </div>
  );
}
