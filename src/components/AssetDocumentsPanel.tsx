"use client";

import {
  deleteAssetDocumentAction,
  uploadAssetDocumentAction,
} from "@/lib/actions";
import type { DocumentTagOption } from "@/lib/document-tags";
import { StyledFileInput } from "@/components/StyledFileInput";

export type AssetDocumentListItem = {
  id: string;
  title: string;
  originalFilename: string;
  storagePath: string;
  sizeBytes: number;
  tags: string[];
  documentDate: string | null;
  createdAt: string;
  uploadedByName?: string;
};

function uploadUrl(path: string) {
  return `/api/uploads/${path
    .split(/[/\\]/)
    .map(encodeURIComponent)
    .join("/")}`;
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AssetDocumentsPanel({
  documents,
  tags,
  assetId,
  canUpload,
  canDelete,
}: {
  documents: AssetDocumentListItem[];
  tags: DocumentTagOption[];
  assetId: string;
  canUpload: boolean;
  canDelete: boolean;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[color:var(--ventia-green)]">
          Asset documents
        </h2>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Drawings, prior reports, as-builts, and supporting records.
        </p>
      </div>

      {canUpload ? (
        <form
          action={uploadAssetDocumentAction}
          className="card grid gap-3 p-4 sm:grid-cols-2"
        >
          <input type="hidden" name="assetId" value={assetId} />
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="font-medium">Title</span>
            <input name="title" required className="field-input w-full" />
          </label>
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="font-medium">File</span>
            <StyledFileInput
              name="file"
              required
              label="Choose file"
              hint="PDF, images, drawings…"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Document date</span>
            <input name="documentDate" type="date" className="field-input w-full" />
          </label>
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-medium">Tags</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {tags.map((tag) => (
                <label key={tag.value} className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="documentTag"
                    value={tag.value}
                    className="accent-[color:var(--ventia-green)]"
                    onChange={(event) => {
                      const form = event.currentTarget.form;
                      if (!form) return;
                      const selected = Array.from(
                        form.querySelectorAll<HTMLInputElement>(
                          'input[name="documentTag"]:checked',
                        ),
                      ).map((input) => input.value);
                      const packed =
                        form.querySelector<HTMLInputElement>('input[name="tagsJson"]');
                      if (packed) packed.value = JSON.stringify(selected);
                    }}
                  />
                  {tag.label}
                </label>
              ))}
            </div>
          </fieldset>
          <input type="hidden" name="tagsJson" defaultValue="[]" />
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Use document date as baseline</span>
            <select name="setBaseline" defaultValue="" className="field-input w-full">
              <option value="">Do not update baseline</option>
              <option value="LEVEL_1">Last Level 1 inspection</option>
              <option value="LEVEL_2">Last Level 2 inspection</option>
            </select>
          </label>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full sm:w-auto">
              Upload document
            </button>
          </div>
        </form>
      ) : null}

      {documents.length === 0 ? (
        <p className="card px-4 py-5 text-sm text-[color:var(--ventia-muted)]">
          No documents uploaded.
        </p>
      ) : (
        <ul className="card divide-y divide-[color:var(--ventia-border)] overflow-hidden">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={uploadUrl(document.storagePath)}
                  className="font-medium text-[color:var(--ventia-blue)] hover:underline"
                  download={document.originalFilename}
                >
                  {document.title}
                </a>
                <p className="text-xs text-[color:var(--ventia-muted)]">
                  {document.originalFilename} · {formatSize(document.sizeBytes)}
                  {document.documentDate
                    ? ` · ${formatDate(document.documentDate)}`
                    : ""}
                  {document.uploadedByName
                    ? ` · uploaded by ${document.uploadedByName}`
                    : ""}
                </p>
                {document.tags.length > 0 ? (
                  <p className="mt-1 text-xs text-[color:var(--ventia-muted)]">
                    {document.tags
                      .map(
                        (value) =>
                          tags.find((tag) => tag.value === value)?.label ?? value,
                      )
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
              {canDelete ? (
                <form action={deleteAssetDocumentAction}>
                  <input type="hidden" name="id" value={document.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-rose-300 px-2 py-1 text-xs text-rose-700 dark:border-rose-800 dark:text-rose-300"
                  >
                    Delete
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
