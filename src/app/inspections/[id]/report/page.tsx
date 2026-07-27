import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatAppDate } from "@/lib/date-time";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canViewInspection } from "@/lib/inspection-access";
import { formatLevel, formatRoadWithParentCode, formatStatus } from "@/lib/inspection";
import { severityLabel, getSeverityOptions } from "@/lib/severities";
import { getExportConfig } from "@/lib/export-config";
import { ExportReportMenu } from "@/components/ExportReportMenu";
import { ClientExportButton } from "@/components/ClientExportButton";
import { VentiaPrintLogo } from "@/components/BrandMark";
import { SecondReviewPanel } from "@/components/SecondReviewPanel";
import { BackNavLink } from "@/components/BackNavLink";
import { formatPersonCredential } from "@/lib/report-people";
import {
  getTemplateForLevel,
  parseFormPayload,
} from "@/lib/inspection-templates";
import { fieldFilled, formatFormFieldDisplayValue } from "@/lib/inspection-template-types";
import { reopenInspectionForEdit } from "@/lib/actions";

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
      reviewedBy: true,
      reviewRequestedFrom: true,
      categories: { orderBy: [{ category: "asc" }, { subcategory: "asc" }] },
      defects: { orderBy: { defectCode: "asc" } },
      permitChecks: { orderBy: { label: "asc" } },
    },
  });
  if (!inspection) notFound();
  if (!canViewInspection(user, inspection)) redirect("/assets");

  const template = getTemplateForLevel(inspection.level);
  const formPayload = parseFormPayload(inspection.formPayload);
  const values = formPayload.values;
  const conditionStates = getSeverityOptions();
  const exportCfg = getExportConfig();

  const reviewCandidates = await prisma.user.findMany({
    where: {
      id: { not: inspection.createdById },
      OR: [{ username: null }, { username: { not: "root" } }],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, level2Qualified: true },
  });

  const inspectorLabel = formatPersonCredential(inspection.createdBy);
  const approverLabel = inspection.approvedBy
    ? formatPersonCredential(inspection.approvedBy)
    : null;
  const reviewerLabel =
    inspection.reviewStatus === "COMPLETED" && inspection.reviewedBy
      ? formatPersonCredential(inspection.reviewedBy)
      : null;

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <BackNavLink fallbackHref={`/assets/${inspection.assetId}`}>
          ← Go back
        </BackNavLink>
        <div className="flex flex-wrap items-center gap-2">
          {(inspection.status === "SUBMITTED" ||
            inspection.status === "APPROVED" ||
            inspection.status === "PENDING_APPROVAL") &&
          (user.role === "ADMIN" || user.id === inspection.createdById) ? (
            <form action={reopenInspectionForEdit}>
              <input type="hidden" name="inspectionId" value={inspection.id} />
              <button
                type="submit"
                className="rounded-md border border-amber-600 px-3 py-2 text-sm font-semibold text-amber-800 dark:text-amber-200"
              >
                Edit report
              </button>
            </form>
          ) : null}
          <ExportReportMenu
            inspectionId={inspection.id}
            label="Export"
            conditionStates={conditionStates}
            defaultSelected={exportCfg.defaultConditionStates}
            allowConditionFilter={exportCfg.filterPdfByConditionStates}
          />
          <ClientExportButton inspectionId={inspection.id} />
          <Link
            href={`/inspections/${inspection.id}/scope`}
            className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm font-semibold text-[color:var(--ventia-green)]"
          >
            Scope export
          </Link>
        </div>
      </div>

      {inspection.permitChecks.length > 0 ? (
        <section className="no-print card space-y-2 p-4 text-sm">
          <h2 className="font-semibold text-[color:var(--ventia-green)]">
            Site permits (web only — not in PDF)
          </h2>
          <ul className="space-y-2">
            {inspection.permitChecks.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-2"
              >
                <p className="font-medium">{p.label}</p>
                {p.willUse ? (
                  <p className="text-[color:var(--ventia-muted)]">Will use / obtain</p>
                ) : (
                  <p className="text-amber-800 dark:text-amber-200">
                    Not needed: {p.notNeededReason || "—"}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <article className="report-sheet mx-auto max-w-3xl rounded-xl border border-[color:var(--ventia-border)] bg-white p-8 text-slate-900 shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none">
        <header className="border-b-2 border-[color:var(--ventia-green)] pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                VenInspect · Inspection Report
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-[color:var(--ventia-green)]">
                {inspection.asset.assetNumber} —{" "}
                {formatRoadWithParentCode(
                  inspection.asset.roadName,
                  inspection.asset.parentAssetCode,
                )}
              </h1>
            </div>
            <VentiaPrintLogo />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {inspection.asset.type} ·{" "}
            {formatRoadWithParentCode(
              inspection.asset.roadName,
              inspection.asset.parentAssetCode,
            )}{" "}
            · {inspection.asset.location ?? "—"}
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
              {formatAppDate(inspection.inspectedAt, "date")}
            </dd>
          </div>
          <div>
            <dt className="text-[color:var(--ventia-muted)]">First submitted</dt>
            <dd className="font-medium">
              {formatAppDate(inspection.submittedAt, "datetime")}
            </dd>
          </div>
          {inspection.lastEditedAt ? (
            <div>
              <dt className="text-[color:var(--ventia-muted)]">Last edited</dt>
              <dd className="font-medium">
                {formatAppDate(inspection.lastEditedAt, "datetime")}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-[color:var(--ventia-muted)]">Inspector</dt>
            <dd className="font-medium">{inspectorLabel}</dd>
          </div>
          {inspection.approvedBy &&
          (inspection.status === "APPROVED" || inspection.approvedAt) ? (
            <div>
              <dt className="text-[color:var(--ventia-muted)]">
                Approved by (Level 2)
              </dt>
              <dd className="font-medium">
                {approverLabel}
                {inspection.approvedAt ? (
                  <span className="mt-0.5 block text-xs font-normal text-[color:var(--ventia-muted)]">
                    {formatAppDate(inspection.approvedAt, "datetime")}
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}
          {reviewerLabel ? (
            <div>
              <dt className="text-[color:var(--ventia-muted)]">Reviewed by</dt>
              <dd className="font-medium">
                {reviewerLabel}
                {inspection.reviewedAt ? (
                  <span className="mt-0.5 block text-xs font-normal text-[color:var(--ventia-muted)]">
                    {formatAppDate(inspection.reviewedAt, "datetime")}
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>

        {(inspection.status === "SUBMITTED" ||
          inspection.status === "APPROVED" ||
          inspection.status === "PENDING_APPROVAL" ||
          inspection.reviewStatus !== "NONE") && (
          <div className="mt-6">
            <SecondReviewPanel
              inspectionId={inspection.id}
              reviewStatus={inspection.reviewStatus}
              reviewNote={inspection.reviewNote}
              requestedFromName={inspection.reviewRequestedFrom?.name ?? null}
              reviewedByLabel={reviewerLabel}
              reviewedAtLabel={
                inspection.reviewedAt
                  ? formatAppDate(inspection.reviewedAt, "datetime")
                  : null
              }
              candidates={reviewCandidates}
              isCreator={
                user.id === inspection.createdById || user.role === "ADMIN"
              }
              isRequestedReviewer={
                inspection.reviewRequestedFromId === user.id
              }
              canComplete={
                user.id !== inspection.createdById &&
                (inspection.reviewRequestedFromId === user.id ||
                  user.role === "ADMIN")
              }
            />
          </div>
        )}

        {inspection.generalComments ? (
          <section className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[color:var(--ventia-green)]">
              General comments
            </h2>
            <p className="mt-2 text-sm leading-relaxed">{inspection.generalComments}</p>
          </section>
        ) : null}

        {template.pages.map((page) => {
          if (page.builtin === "defects" || page.builtin === "photos") return null;
          const sectionsWithData = page.sections
            .map((sec) => ({
              ...sec,
              fields: sec.fields.filter((f) => fieldFilled(values[f.id])),
            }))
            .filter((sec) => sec.fields.length > 0);
          if (sectionsWithData.length === 0) return null;
          return (
            <section key={page.id} className="mt-6">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[color:var(--ventia-green)]">
                {page.title}
              </h2>
              {sectionsWithData.map((sec) => (
                <div key={sec.id} className="mt-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {sec.title}
                  </h3>
                  <table className="mt-1 w-full border-collapse text-left text-sm">
                    <tbody>
                      {sec.fields.map((f) => (
                        <tr
                          key={f.id}
                          className="border-b border-[color:var(--ventia-border)] align-top"
                        >
                          <td className="py-2 pr-2 font-medium w-[40%]">{f.label}</td>
                          <td className="py-2 whitespace-pre-wrap">{formatFormFieldDisplayValue(f, values[f.id])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </section>
          );
        })}

        {inspection.categories.length > 0 &&
        !Object.keys(values).some((k) => fieldFilled(values[k])) ? (
          <section className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[color:var(--ventia-green)]">
              Element comments (legacy)
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
                  <tr
                    key={c.id}
                    className="border-b border-[color:var(--ventia-border)] align-top"
                  >
                    <td className="py-2 pr-2">{c.category}</td>
                    <td className="py-2 pr-2">{c.subcategory}</td>
                    <td className="py-2">{c.comments || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

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
