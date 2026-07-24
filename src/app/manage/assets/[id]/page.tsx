import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  importAssetAuditExportAction,
  updateAssetDetails,
  combineInspectionsAsParent,
} from "@/lib/actions";
import {
  computeLevelSchedule,
  formatAssetType,
  formatLevel,
  formatStatus,
} from "@/lib/inspection";
import { ASSET_PERMIT_FLAGS } from "@/lib/permits";
import { getAssetTypes } from "@/lib/asset-types";
import { getDocumentTags } from "@/lib/document-tags";
import { parseAssetComponents, parseAssetProfile } from "@/lib/asset-profile";
import { AssetComponentsEditor } from "@/components/AssetComponentsEditor";
import { AssetAttributesEditor } from "@/components/AssetAttributesEditor";
import { ClearanceHistoryPanel } from "@/components/ClearanceHistoryPanel";
import {
  AssetDocumentsPanel,
  type AssetDocumentListItem,
} from "@/components/AssetDocumentsPanel";
import { ManageAssetTabs } from "@/components/ManageAssetTabs";
import { DotWorkbookImport } from "@/components/DotWorkbookImport";
import { AdminDeleteInspectionButton } from "@/components/AdminDeleteInspectionButton";
import { StatusPill } from "@/components/StatusPill";

export const dynamic = "force-dynamic";

export default async function ManageAssetEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; tab?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { saved } = await searchParams;
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      documents: {
        include: { uploadedBy: true },
        orderBy: { createdAt: "desc" },
      },
      inspections: {
        include: { createdBy: true, defects: true, children: true, parent: true },
        orderBy: { submittedAt: "desc" },
      },
    },
  });
  if (!asset) notFound();
  const assetTypes = getAssetTypes();
  const documentTags = getDocumentTags();
  const components = parseAssetComponents(asset.componentsJson);
  const profile = parseAssetProfile(asset.profileJson);
  const documents: AssetDocumentListItem[] = asset.documents.map((document) => ({
    id: document.id,
    title: document.title,
    originalFilename: document.originalFilename,
    storagePath: document.storagePath,
    sizeBytes: document.sizeBytes,
    tags: parseTags(document.tagsJson),
    documentDate: document.documentDate?.toISOString() ?? null,
    createdAt: document.createdAt.toISOString(),
    uploadedByName: document.uploadedBy.name,
  }));

  const l1 = computeLevelSchedule(asset, asset.inspections, "LEVEL_1");
  const l2 = computeLevelSchedule(asset, asset.inspections, "LEVEL_2");
  const standalones = asset.inspections.filter((i) => i.relationKind !== "CHILD");
  const manageNext = `/manage/assets/${asset.id}`;

  const mainTab = (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[color:var(--ventia-green)]">
            {asset.name}
          </h2>
          <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
            {formatAssetType(asset.type)} · {asset.roadName}
            {asset.location ? ` · ${asset.location}` : ""}
          </p>
        </div>
        <Link
          href={`/inspect?assetId=${asset.id}`}
          className="rounded-md bg-[color:var(--ventia-green)] px-3 py-2 text-sm font-medium text-white"
        >
          New inspection
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <ScheduleCard
          title="Level 1"
          interval={asset.level1IntervalYears}
          schedule={l1}
          baselineAt={asset.lastLevel1At}
        />
        <ScheduleCard
          title="Level 2"
          interval={asset.level2IntervalYears}
          schedule={l2}
          baselineAt={asset.lastLevel2At}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Previous reports</h2>
        <p className="text-xs text-[color:var(--ventia-muted)]">
          Admins can delete any report. Deletion requires your password and typing{" "}
          <span className="font-mono">DELETE</span> (or the exact report title).
        </p>
        {asset.inspections.length === 0 ? (
          <p className="text-sm text-[color:var(--ventia-muted)]">No inspections yet.</p>
        ) : (
          <ul className="divide-y divide-[color:var(--ventia-border)] overflow-hidden rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)]">
            {asset.inspections.map((insp) => (
              <li
                key={insp.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/inspections/${insp.id}`}
                    className="font-medium text-[color:var(--ventia-green)] hover:underline"
                  >
                    {insp.titleLabel}
                    {insp.status === "DRAFT" ? " (draft)" : ""}
                  </Link>
                  <p className="text-xs text-[color:var(--ventia-muted)]">
                    {formatLevel(insp.level)} · {formatStatus(insp.status)} ·{" "}
                    {format(insp.submittedAt, "dd MMM yyyy HH:mm")} · by{" "}
                    {insp.createdBy.name} · {insp.defects.length} defect
                    {insp.defects.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {insp.status !== "DRAFT" ? (
                    <>
                      <Link
                        href={`/inspections/${insp.id}/report`}
                        className="text-[color:var(--ventia-blue)] hover:underline"
                      >
                        Full report
                      </Link>
                      <Link
                        href={`/inspections/${insp.id}/scope`}
                        className="text-[color:var(--ventia-blue)] hover:underline"
                      >
                        Scope export
                      </Link>
                    </>
                  ) : (
                    <Link
                      href={`/inspections/${insp.id}`}
                      className="text-[color:var(--ventia-blue)] hover:underline"
                    >
                      Open draft
                    </Link>
                  )}
                  <AdminDeleteInspectionButton
                    inspectionId={insp.id}
                    titleLabel={insp.titleLabel}
                    status={formatStatus(insp.status)}
                    next={manageNext}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {standalones.filter((i) => i.status !== "DRAFT").length >= 2 ? (
        <section className="rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-5">
          <h2 className="font-medium">Combine two reports</h2>
          <p className="mt-1 text-xs text-[color:var(--ventia-muted)]">
            Creates a parent inspection and links both as children.
          </p>
          <form action={combineInspectionsAsParent} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="assetId" value={asset.id} />
            <select
              name="inspectionA"
              required
              className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                First report…
              </option>
              {standalones
                .filter((i) => i.status !== "DRAFT")
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.titleLabel}
                  </option>
                ))}
            </select>
            <select
              name="inspectionB"
              required
              className="rounded-md border border-[color:var(--ventia-border)] px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Second report…
              </option>
              {standalones
                .filter((i) => i.status !== "DRAFT")
                .map((i) => (
                  <option key={`b-${i.id}`} value={i.id}>
                    {i.titleLabel}
                  </option>
                ))}
            </select>
            <button
              type="submit"
              className="sm:col-span-2 rounded-md bg-[color:var(--ventia-blue)] px-4 py-2 text-sm font-semibold text-white"
            >
              Create parent + link children
            </button>
          </form>
        </section>
      ) : null}

      <p className="text-xs text-[color:var(--ventia-muted)]">
        Field users see the same history on{" "}
        <Link href={`/assets/${asset.id}`} className="underline">
          the user asset page
        </Link>
        .
      </p>
    </div>
  );

  const detailsTab = (
    <div className="space-y-6">
      {saved ? (
        <p className="rounded-lg border border-[color:var(--ventia-border)] bg-[color:var(--ventia-green-tint)] px-3 py-2 text-sm">
          Saved.
        </p>
      ) : null}

      <form action={updateAssetDetails} className="card space-y-4 p-5">
        <input type="hidden" name="id" value={asset.id} />

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="font-medium text-[color:var(--ventia-muted)]">Road name</span>
            <input
              name="roadName"
              required
              defaultValue={asset.roadName}
              className="field-input w-full"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[color:var(--ventia-muted)]">Code</span>
            <input
              name="assetNumber"
              required
              defaultValue={asset.assetNumber}
              className="field-input w-full font-mono"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[color:var(--ventia-muted)]">Type</span>
            <select name="type" defaultValue={asset.type} className="field-input w-full">
              {assetTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="font-medium text-[color:var(--ventia-muted)]">Name</span>
            <input name="name" required defaultValue={asset.name} className="field-input w-full" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[color:var(--ventia-muted)]">Asset Vision ID</span>
            <input
              name="assetVisionId"
              defaultValue={asset.assetVisionId ?? ""}
              className="field-input w-full"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[color:var(--ventia-muted)]">Classification</span>
            <input
              name="classification"
              defaultValue={asset.classification ?? ""}
              className="field-input w-full"
            />
          </label>
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="font-medium text-[color:var(--ventia-muted)]">Location</span>
            <input
              name="location"
              defaultValue={asset.location ?? ""}
              className="field-input w-full"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[color:var(--ventia-muted)]">Latitude</span>
            <input
              name="latitude"
              defaultValue={asset.latitude ?? ""}
              placeholder="-37.8"
              className="field-input w-full font-mono"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[color:var(--ventia-muted)]">Longitude</span>
            <input
              name="longitude"
              defaultValue={asset.longitude ?? ""}
              placeholder="144.9"
              className="field-input w-full font-mono"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[color:var(--ventia-muted)]">Level 1 interval (years)</span>
            <input
              name="level1IntervalYears"
              type="number"
              min={1}
              defaultValue={asset.level1IntervalYears}
              className="field-input w-full"
            />
            <p className="mt-1 text-[10px] text-[color:var(--ventia-muted)]">
              Overridden by Admin → Inspection types for due dates; kept for per-asset notes.
            </p>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[color:var(--ventia-muted)]">Level 2 interval (years)</span>
            <input
              name="level2IntervalYears"
              type="number"
              min={1}
              defaultValue={asset.level2IntervalYears}
              className="field-input w-full"
            />
            <p className="mt-1 text-[10px] text-[color:var(--ventia-muted)]">
              Due dates follow Admin → Inspection types; saving types updates all assets.
            </p>
          </label>
        </div>

        <fieldset className="space-y-3 rounded-xl border border-[color:var(--ventia-border)] p-4">
          <legend className="px-1 text-sm font-semibold">
            Last inspection baselines (manual)
          </legend>
          <p className="text-xs text-[color:var(--ventia-muted)]">
            Use these when history isn’t in VenInspect yet. Due dates use the later of this
            baseline and any submitted inspection in the app. Clear a field to remove the
            baseline.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-[color:var(--ventia-muted)]">
                Last Level 1
              </span>
              <input
                name="lastLevel1At"
                type="date"
                defaultValue={
                  asset.lastLevel1At ? format(asset.lastLevel1At, "yyyy-MM-dd") : ""
                }
                className="field-input w-full"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-[color:var(--ventia-muted)]">
                Last Level 2
              </span>
              <input
                name="lastLevel2At"
                type="date"
                defaultValue={
                  asset.lastLevel2At ? format(asset.lastLevel2At, "yyyy-MM-dd") : ""
                }
                className="field-input w-full"
              />
            </label>
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="font-medium text-[color:var(--ventia-muted)]">Notes</span>
            <textarea
              name="notes"
              rows={3}
              defaultValue={asset.notes ?? ""}
              className="field-input w-full"
            />
          </label>
        </div>

        <fieldset className="space-y-2 rounded-xl border border-[color:var(--ventia-border)] p-4">
          <legend className="px-1 text-sm font-semibold">Required site permits</legend>
          <p className="text-xs text-[color:var(--ventia-muted)]">
            When flagged, inspectors must confirm each item when starting an inspection. Tracked on
            the web report only (not PDF).
          </p>
          {ASSET_PERMIT_FLAGS.map((f) => (
            <label key={f.key} className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name={f.assetField}
                defaultChecked={asset[f.assetField]}
                className="mt-1 h-4 w-4 accent-[color:var(--ventia-green)]"
              />
              <span>
                <span className="font-medium">{f.label}</span>
                <span className="block text-xs text-[color:var(--ventia-muted)]">{f.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary">
            Save asset
          </button>
          <Link
            href={`/assets/${asset.id}`}
            className="rounded-xl border border-[color:var(--ventia-border)] px-4 py-2.5 text-sm font-semibold"
          >
            Open user view
          </Link>
        </div>
        <p className="text-xs text-[color:var(--ventia-muted)]">
          Current type label: {formatAssetType(asset.type)}
        </p>
      </form>

      <section className="card space-y-4 p-5">
        <AssetAttributesEditor
          assetId={asset.id}
          initialValues={profile.values}
          initialAutoPopulate={profile.autoPopulate ?? {}}
          coreDefaults={{
            __assetNumber: asset.assetNumber,
            __roadName: asset.roadName,
            __name: asset.name,
            __location: asset.location ?? "",
            __latitude: asset.latitude != null ? String(asset.latitude) : "",
            __longitude: asset.longitude != null ? String(asset.longitude) : "",
            __notes: asset.notes ?? "",
            __seedClearancesFromPrior: "",
          }}
        />
      </section>

      <section className="card space-y-4 p-5">
        <ClearanceHistoryPanel assetId={asset.id} />
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="font-semibold text-[color:var(--ventia-green)]">
            Asset components
          </h2>
          <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
            Register inspectable parts for consistent defect tagging.
          </p>
        </div>
        <AssetComponentsEditor assetId={asset.id} initial={components} />
      </section>

      <form action={importAssetAuditExportAction} className="card space-y-4 p-5">
        <input type="hidden" name="assetId" value={asset.id} />
        <div>
          <h2 className="font-semibold text-[color:var(--ventia-green)]">
            Import Audit Export
          </h2>
          <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
            Import profile attributes from an Asset Vision audit export. Download a
            template if you are preparing data manually.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/manage/import-templates/audit?format=csv"
            className="rounded-lg border border-[color:var(--ventia-border)] px-3 py-1.5 text-xs font-semibold"
          >
            Download CSV template
          </a>
          <a
            href="/api/manage/import-templates/audit?format=xlsx"
            className="rounded-lg border border-[color:var(--ventia-green)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ventia-green)]"
          >
            Download Excel template
          </a>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">File</span>
          <input
            name="file"
            type="file"
            required
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            id="audit-import-file"
          />
          <label
            htmlFor="audit-import-file"
            className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[color:var(--ventia-border)] px-4 py-5 text-center transition hover:border-[color:var(--ventia-green)]"
          >
            <span className="text-sm font-semibold text-[color:var(--ventia-green)]">
              Choose audit file
            </span>
            <span className="text-xs text-[color:var(--ventia-muted)]">
              .xlsx / .xls / .csv
            </span>
          </label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="allowClears"
            value="1"
            className="accent-[color:var(--ventia-green)]"
          />
          Allow blank imported values to clear existing profile values
        </label>
        <button type="submit" className="btn-primary">
          Import audit export
        </button>
      </form>

      <AssetDocumentsPanel
        documents={documents}
        tags={documentTags}
        assetId={asset.id}
        canUpload
        canDelete
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/manage/assets"
          className="text-sm text-[color:var(--ventia-blue)] hover:underline"
        >
          ← Asset registry
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[color:var(--ventia-green)]">
          {asset.roadName} / {asset.assetNumber}
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Main: reports &amp; schedule. Details: registry fields, attributes, components,
          documents.
        </p>
      </div>

      <Suspense
        fallback={<p className="text-sm text-[color:var(--ventia-muted)]">Loading…</p>}
      >
        <ManageAssetTabs
          main={mainTab}
          details={detailsTab}
          history={
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--ventia-green)]">
                  Condition history
                </h2>
                <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
                  Track component CS quantities across inspections, and import prior
                  DoT workbooks for context.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Link
                  href={`/manage/assets/${asset.id}/history`}
                  className="rounded-xl border border-[color:var(--ventia-border)] p-5 transition hover:border-[color:var(--ventia-green)] hover:bg-[color:var(--ventia-green-tint)]"
                >
                  <p className="font-semibold text-[color:var(--ventia-green)]">
                    View CS timeline chart
                  </p>
                  <p className="mt-2 text-xs text-[color:var(--ventia-muted)]">
                    Search components and see condition-state quantities over time
                    from submitted / approved reports.
                  </p>
                  <span className="mt-3 inline-block text-sm font-semibold text-[color:var(--ventia-blue)]">
                    Open chart →
                  </span>
                </Link>
                <div className="rounded-xl border border-[color:var(--ventia-border)] p-5">
                  <p className="font-semibold text-[color:var(--ventia-green)]">
                    Tips
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[color:var(--ventia-muted)]">
                    <li>History is built from component rating tables on reports.</li>
                    <li>Import a prior Level 2/3 workbook to capture References lists.</li>
                    <li>Set lat/lng on Details so the asset appears on the map.</li>
                  </ul>
                </div>
              </div>

              <div className="card space-y-3 p-5">
                <h3 className="font-medium">Import DoT / Level 2 workbook</h3>
                <DotWorkbookImport assetId={asset.id} />
              </div>
            </div>
          }
        />
      </Suspense>
    </div>
  );
}

function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function ScheduleCard({
  title,
  interval,
  schedule,
  baselineAt,
}: {
  title: string;
  interval: number;
  schedule: ReturnType<typeof computeLevelSchedule>;
  baselineAt: Date | null;
}) {
  const usingBaselineOnly =
    Boolean(baselineAt) &&
    schedule.lastInspectedAt &&
    baselineAt!.getTime() === schedule.lastInspectedAt.getTime();

  return (
    <div className="rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{title}</h3>
        <StatusPill status={schedule.status} />
      </div>
      <p className="mt-2 text-sm text-[color:var(--ventia-muted)]">Every {interval} years</p>
      <p className="mt-1 text-sm">
        Last:{" "}
        {schedule.lastInspectedAt
          ? format(schedule.lastInspectedAt, "dd MMM yyyy")
          : "None"}
        {usingBaselineOnly ? (
          <span className="text-[color:var(--ventia-muted)]"> (manual baseline)</span>
        ) : null}
      </p>
      <p className="text-sm">
        Next due:{" "}
        {schedule.nextDueAt ? format(schedule.nextDueAt, "dd MMM yyyy") : "—"}
      </p>
    </div>
  );
}
