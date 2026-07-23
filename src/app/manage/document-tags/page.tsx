import { DocumentTagsForm } from "@/components/DocumentTagsForm";
import { getDocumentTags } from "@/lib/document-tags";

export const dynamic = "force-dynamic";

export default function ManageDocumentTagsPage() {
  const tags = getDocumentTags();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
          Document tags
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ventia-muted)]">
          Manage the labels used to classify drawings, prior reports, and other
          asset documents.
        </p>
      </div>
      <div className="card p-5">
        <DocumentTagsForm initial={tags} />
      </div>
    </div>
  );
}
