import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getInspectionTemplates } from "@/lib/inspection-templates";
import { TemplateEditor } from "@/components/TemplateEditor";

export const dynamic = "force-dynamic";

export default async function EditInspectionTemplatePage({
  params,
}: {
  params: Promise<{ typeCode: string }>;
}) {
  await requireAdmin();
  const { typeCode } = await params;
  const code = decodeURIComponent(typeCode).toUpperCase().replace(/\s+/g, "_");
  const templates = getInspectionTemplates();
  const template = templates[code];
  if (!template) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link
          href="/manage/inspection-templates"
          className="text-sm text-[color:var(--ventia-blue)] hover:underline"
        >
          ← Templates
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-[color:var(--ventia-green)]">
          Edit {template.label}
        </h1>
      </div>
      <TemplateEditor initial={template} />
    </div>
  );
}
