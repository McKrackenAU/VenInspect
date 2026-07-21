import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getInspectionTemplates } from "@/lib/inspection-templates";

export const dynamic = "force-dynamic";

export default async function InspectionTemplatesIndexPage() {
  await requireAdmin();
  const templates = getInspectionTemplates();
  const list = Object.values(templates).sort((a, b) =>
    a.typeCode.localeCompare(b.typeCode),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
          Inspection templates
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[color:var(--ventia-muted)]">
          Admin-editable forms for each inspection type. Add or remove pages, sections,
          and fields. Inspectors see a clean collapsed UI that autosaves into drafts.
        </p>
      </div>

      <ul className="divide-y divide-[color:var(--ventia-border)] overflow-hidden rounded-xl border border-[color:var(--ventia-border)] bg-[color:var(--panel)]">
        {list.map((t) => (
          <li key={t.typeCode}>
            <Link
              href={`/manage/inspection-templates/${t.typeCode}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[color:var(--ventia-green-tint)]"
            >
              <div>
                <p className="font-semibold text-[color:var(--ventia-green)]">
                  {t.label}
                </p>
                <p className="text-xs text-[color:var(--ventia-muted)]">
                  {t.typeCode} · {t.pages.length} page
                  {t.pages.length === 1 ? "" : "s"}
                </p>
              </div>
              <span className="text-sm text-[color:var(--ventia-blue)]">Edit →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
