import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  canEditInspection,
  canViewInspection,
} from "@/lib/inspection-access";
import {
  linkAsChildInspection,
  submitInspection,
  updateGeneralComments,
} from "@/lib/actions";
import { DefectAddForm } from "@/components/DefectAddForm";
import { CarryForwardDefects } from "@/components/CarryForwardDefects";
import { DeleteDraftButton } from "@/components/DeleteDraftButton";
import { InspectionDraftWorkspace } from "@/components/InspectionDraftWorkspace";
import { formatLevel, formatStatus } from "@/lib/inspection";
import {
  getTemplateForLevel,
  parseFormPayload,
} from "@/lib/inspection-templates";
import { getSeverityOptions, severityLabel } from "@/lib/severities";
import { parseAssetComponents } from "@/lib/asset-profile";

export const dynamic = "force-dynamic";

function photoUrl(path: string) {
  return `/api/uploads/${path.split(/[/\\]/).map(encodeURIComponent).join("/")}`;
}

export default async function InspectionPage({
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
      parent: true,
      children: true,
      defects: { orderBy: { defectCode: "asc" } },
      permitChecks: { orderBy: { label: "asc" } },
    },
  });
  if (!inspection) notFound();
  if (!canViewInspection(user, inspection)) redirect("/assets");

  const editable = canEditInspection(user, inspection);
  const isDraft =
    inspection.status === "DRAFT" || inspection.status === "REJECTED";
  const severities = getSeverityOptions();
  const template = getTemplateForLevel(inspection.level);
  const formPayload = parseFormPayload(inspection.formPayload);

  const siblings = await prisma.inspection.findMany({
    where: {
      assetId: inspection.assetId,
      id: { not: inspection.id },
      relationKind: { not: "CHILD" },
      OR:
        user.role === "ADMIN"
          ? undefined
          : [{ status: { not: "DRAFT" } }, { createdById: user.id }],
    },
    orderBy: { submittedAt: "desc" },
    take: 20,
  });

  const priorDefects =
    editable && isDraft
      ? await prisma.defect.findMany({
          where: {
            inspection: {
              assetId: inspection.assetId,
              id: { not: inspection.id },
              status: { not: "DRAFT" },
            },
          },
          include: { inspection: { select: { titleLabel: true } } },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : [];

  const assetComponents = parseAssetComponents(inspection.asset.componentsJson);

  const defectsSlot = (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-[color:var(--ventia-green)]">
        Defects
      </h2>
      {inspection.defects.length === 0 ? (
        <p className="text-sm text-[color:var(--ventia-muted)]">
          No defects yet. Photo is required — stored compressed.
        </p>
      ) : (
        <ul className="space-y-2">
          {inspection.defects.map((d) => (
            <li key={d.id} className="card px-4 py-3">
              <div className="flex flex-wrap gap-4">
                {d.photoPath || d.comparisonPhotoPath ? (
                  <div className="flex gap-2">
                    {d.comparisonPhotoPath ? (
                      <div>
                        <p className="mb-1 text-[0.65rem] uppercase text-[color:var(--ventia-muted)]">
                          Was
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photoUrl(d.comparisonPhotoPath)}
                          alt="Prior"
                          className="h-24 w-28 rounded-md object-cover"
                        />
                      </div>
                    ) : null}
                    {d.photoPath ? (
                      <div>
                        {d.comparisonPhotoPath ? (
                          <p className="mb-1 text-[0.65rem] uppercase text-[color:var(--ventia-muted)]">
                            Now
                          </p>
                        ) : null}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photoUrl(d.photoPath)}
                          alt={d.defectCode}
                          className="h-24 w-28 rounded-md object-cover"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-[color:var(--ventia-green)]">
                      {d.defectCode}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-[color:var(--ventia-muted)]">
                      {severityLabel(d.severity)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{d.description}</p>
                  {d.comments ? (
                    <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
                      {d.comments}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editable ? (
        <DefectAddForm
          inspectionId={inspection.id}
          severities={severities}
          components={assetComponents.map((c) => ({
            id: c.id,
            name: c.name,
            category: c.category,
          }))}
        />
      ) : null}

      {editable && isDraft ? (
        <CarryForwardDefects
          inspectionId={inspection.id}
          severities={severities}
          components={assetComponents.map((c) => ({
            id: c.id,
            name: c.name,
            category: c.category,
          }))}
          priors={priorDefects.map((d) => ({
            id: d.id,
            defectCode: d.defectCode,
            description: d.description,
            comments: d.comments,
            severity: d.severity,
            photoPath: d.photoPath,
            inspectionLabel: d.inspection.titleLabel,
            componentId: d.componentId,
            category: d.category,
            subcategory: d.subcategory,
          }))}
        />
      ) : null}
    </section>
  );

  const photosSlot = (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-[color:var(--ventia-green)]">
        Photographic record
      </h2>
      <p className="text-sm text-[color:var(--ventia-muted)]">
        Defect photos are attached on the Defects page. Use register notes below for
        additional photo references.
      </p>
      {inspection.defects.filter((d) => d.photoPath).length === 0 ? (
        <p className="text-sm text-[color:var(--ventia-muted)]">
          No defect photos yet.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {inspection.defects
            .filter((d) => d.photoPath)
            .map((d) => (
              <li key={d.id} className="card p-3">
                <p className="font-mono text-xs font-semibold text-[color:var(--ventia-green)]">
                  {d.defectCode}
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl(d.photoPath!)}
                  alt={d.defectCode}
                  className="mt-2 max-h-40 w-full rounded object-contain"
                />
              </li>
            ))}
        </ul>
      )}
    </section>
  );

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
            {formatLevel(inspection.level)} · {formatStatus(inspection.status)}
            {isDraft ? " · draft (only you & admins)" : ""} ·{" "}
            {format(inspection.submittedAt, "dd MMM yyyy HH:mm")} · by{" "}
            {inspection.createdBy.name}
            {" · folder "}
            <code className="text-xs">{inspection.folderKey}</code>
          </p>
        </div>
        {!isDraft ? (
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
        ) : editable ? (
          <DeleteDraftButton
            inspectionId={inspection.id}
            next={`/assets/${inspection.assetId}`}
            label="Delete draft"
          />
        ) : null}
      </div>

      {inspection.permitChecks.length > 0 ? (
        <section className="card space-y-2 p-4 text-sm">
          <h2 className="font-semibold text-[color:var(--ventia-green)]">Site permits</h2>
          <p className="text-xs text-[color:var(--ventia-muted)]">
            Recorded for this visit (shown on web report; excluded from PDF).
          </p>
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

      <section className="card p-4">
        <h2 className="text-sm font-semibold text-[color:var(--ventia-muted)]">
          General comments
        </h2>
        {editable ? (
          <form action={updateGeneralComments} className="mt-2 space-y-2">
            <input type="hidden" name="inspectionId" value={inspection.id} />
            <textarea
              name="generalComments"
              rows={3}
              defaultValue={inspection.generalComments ?? ""}
              className="field-input min-h-[5rem]"
            />
            <button
              type="submit"
              className="rounded-lg bg-[color:var(--ventia-green)] px-3 py-1.5 text-xs font-semibold text-white"
            >
              Save notes
            </button>
          </form>
        ) : (
          <p className="mt-2 text-sm">
            {inspection.generalComments?.trim() || "—"}
          </p>
        )}
      </section>

      <InspectionDraftWorkspace
        inspectionId={inspection.id}
        template={template}
        initialPayload={formPayload}
        editable={editable}
        assetType={inspection.asset.type}
        defectsSlot={defectsSlot}
        photosSlot={photosSlot}
      />

      {editable && isDraft ? (
        <form
          action={submitInspection}
          className="rounded-2xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-4 shadow-sm"
        >
          <input type="hidden" name="inspectionId" value={inspection.id} />
          <p className="mb-3 text-sm text-[color:var(--ventia-muted)]">
            This stays a private draft until you submit. Jump between tabs anytime —
            answers autosave. After submit you get the full report and can export PDF /
            scope.
          </p>
          <button type="submit" className="btn-primary w-full text-base">
            Submit inspection → view report
          </button>
        </form>
      ) : null}

      {siblings.length > 0 && inspection.relationKind !== "CHILD" && editable ? (
        <section className="card p-4">
          <h2 className="text-sm font-medium">Link as child of another report</h2>
          <form action={linkAsChildInspection} className="mt-2 flex flex-wrap gap-2">
            <input type="hidden" name="childId" value={inspection.id} />
            <select
              name="parentId"
              required
              className="field-input min-w-[16rem] flex-1"
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
      ) : null}
    </div>
  );
}
