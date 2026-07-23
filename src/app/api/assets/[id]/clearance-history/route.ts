import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { format } from "date-fns";
import {
  migrateLegacyClearanceMeasurements,
  parseFormPayload,
  parseMeasurementList,
} from "@/lib/inspection-template-types";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type ClearanceHistoryRow = {
  inspectionId: string;
  titleLabel: string;
  level: string;
  status: string;
  inspectedAt: string;
  measurements: { label: string; value: string }[];
  sag: string;
  rounded: string;
};

async function loadHistory(assetId: string): Promise<ClearanceHistoryRow[]> {
  const inspections = await prisma.inspection.findMany({
    where: { assetId, formPayload: { not: null } },
    orderBy: [{ inspectedAt: "asc" }, { submittedAt: "asc" }],
    select: {
      id: true,
      titleLabel: true,
      level: true,
      status: true,
      inspectedAt: true,
      formPayload: true,
    },
  });

  const rows: ClearanceHistoryRow[] = [];
  for (const insp of inspections) {
    const values = migrateLegacyClearanceMeasurements(
      parseFormPayload(insp.formPayload).values,
    );
    let measurements = parseMeasurementList(values.vc_measurements);
    if (measurements.length === 0) {
      measurements = [1, 2, 3, 4, 5].map((n) => ({
        id: `m${n}`,
        label: `Measurement ${n}`,
        value: values[`vc_m${n}`] ?? "",
      }));
    }
    const filled = measurements.filter((m) => m.value.trim());
    const sag = values.vc_sag?.trim() ?? "";
    const rounded = values.vc_rounded?.trim() ?? "";
    if (filled.length === 0 && !sag && !rounded) continue;
    rows.push({
      inspectionId: insp.id,
      titleLabel: insp.titleLabel,
      level: insp.level,
      status: insp.status,
      inspectedAt: format(insp.inspectedAt, "yyyy-MM-dd"),
      measurements: filled.map((m) => ({
        label: m.label || m.id,
        value: m.value,
      })),
      sag,
      rounded,
    });
  }
  return rows;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id: assetId } = await context.params;
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const history = await loadHistory(assetId);
  const formatParam = req.nextUrl.searchParams.get("format");

  if (formatParam === "xlsx") {
    const flat = history.flatMap((h) => {
      if (h.measurements.length === 0) {
        return [
          {
            Date: h.inspectedAt,
            Inspection: h.titleLabel,
            Level: h.level,
            Status: h.status,
            Measurement: "",
            Value_m: "",
            Sag: h.sag,
            Rounded: h.rounded,
          },
        ];
      }
      return h.measurements.map((m, i) => ({
        Date: h.inspectedAt,
        Inspection: h.titleLabel,
        Level: h.level,
        Status: h.status,
        Measurement: m.label,
        Value_m: m.value,
        Sag: i === 0 ? h.sag : "",
        Rounded: i === 0 ? h.rounded : "",
      }));
    });
    const ws = XLSX.utils.json_to_sheet(
      flat.length
        ? flat
        : [
            {
              Date: "",
              Note: "No clearance measurements recorded yet",
              Asset: asset.assetNumber,
            },
          ],
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clearance history");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const filename = `${asset.assetNumber}_clearance_history.xlsx`;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ assetNumber: asset.assetNumber, history });
}
