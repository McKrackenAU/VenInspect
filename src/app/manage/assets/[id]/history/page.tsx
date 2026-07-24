import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import { parseFormPayload } from "@/lib/inspection-templates";
import { ComponentCsHistoryChart } from "@/components/ComponentCsHistoryChart";

export const dynamic = "force-dynamic";

export default async function ComponentHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) notFound();

  const inspections = await prisma.inspection.findMany({
    where: {
      assetId: id,
      deletedAt: null,
      status: { in: ["SUBMITTED", "APPROVED", "PENDING_APPROVAL"] },
    },
    orderBy: { inspectedAt: "asc" },
    select: { inspectedAt: true, formPayload: true, titleLabel: true },
  });

  const series: {
    label: string;
    at: string;
    cs1: number;
    cs2: number;
    cs3: number;
    cs4: number;
    qty: number;
  }[] = [];

  for (const insp of inspections) {
    const values = parseFormPayload(insp.formPayload).values;
    for (const [key, raw] of Object.entries(values)) {
      if (!raw?.trim().startsWith("[")) continue;
      try {
        const rows = JSON.parse(raw) as {
          name?: string;
          qty?: string;
          cs1?: string;
          cs2?: string;
          cs3?: string;
          cs4?: string;
        }[];
        if (!Array.isArray(rows)) continue;
        for (const r of rows) {
          if (!r.name) continue;
          series.push({
            label: r.name,
            at: insp.inspectedAt.toISOString(),
            qty: Number.parseFloat(String(r.qty ?? "")) || 0,
            cs1: Number.parseFloat(String(r.cs1 ?? "")) || 0,
            cs2: Number.parseFloat(String(r.cs2 ?? "")) || 0,
            cs3: Number.parseFloat(String(r.cs3 ?? "")) || 0,
            cs4: Number.parseFloat(String(r.cs4 ?? "")) || 0,
          });
        }
        void key;
      } catch {
        /* skip */
      }
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-[color:var(--ventia-green)]">
          Component condition history
        </h1>
        <p className="text-sm text-[color:var(--ventia-muted)]">
          {asset.assetNumber} — {asset.name}. Bars show CS2–4 quantity over time.
        </p>
      </div>
      <ComponentCsHistoryChart series={series} />
    </div>
  );
}
