import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canViewInspection } from "@/lib/inspection-access";
import { getSeverityOptions } from "@/lib/severities";
import { getExportConfig } from "@/lib/export-config";
import { ClientExportWizard } from "@/components/ClientExportWizard";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ClientExportPage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const inspection = await prisma.inspection.findUnique({
    where: { id },
    select: {
      id: true,
      titleLabel: true,
      createdById: true,
      status: true,
    },
  });
  if (!inspection) notFound();
  if (!canViewInspection(user, inspection)) notFound();

  const conditionStates = getSeverityOptions();
  const exportCfg = getExportConfig();

  return (
    <ClientExportWizard
      inspectionId={inspection.id}
      reportHref={`/inspections/${inspection.id}/report`}
      titleLabel={inspection.titleLabel}
      conditionStates={conditionStates}
      defaultSelected={exportCfg.defaultConditionStates}
    />
  );
}
