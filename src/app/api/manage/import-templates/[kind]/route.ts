import { NextResponse } from "next/server";
import {
  ASSET_AUDIT_TEMPLATE_HEADERS,
  ASSET_COMPONENTS_TEMPLATE_HEADERS,
  ASSET_REGISTRY_TEMPLATE_HEADERS,
  csvFromHeaders,
  xlsxBufferFromHeaders,
} from "@/lib/import-templates";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEMPLATES: Record<
  string,
  {
    filename: string;
    csvSample?: string[][];
    xlsxSample?: string[][];
    headers: readonly string[];
    sheet: string;
  }
> = {
  assets: {
    filename: "veninspect_asset_registry_template",
    headers: ASSET_REGISTRY_TEMPLATE_HEADERS,
    sheet: "Assets",
    csvSample: [
      [
        "SN0001",
        "Example Bridge",
        "EXAMPLE RD",
        "BRIDGE",
        "Over creek",
        "-37.8",
        "144.9",
        "",
        "",
        "",
      ],
    ],
  },
  audit: {
    filename: "veninspect_audit_export_template",
    headers: ASSET_AUDIT_TEMPLATE_HEADERS,
    sheet: "Audit",
    csvSample: [
      ["Structure ID", "SN0001", ""],
      ["Length (m)", "24.5", ""],
      ["Road name", "EXAMPLE RD", ""],
    ],
  },
  components: {
    filename: "veninspect_components_template",
    headers: ASSET_COMPONENTS_TEMPLATE_HEADERS,
    sheet: "Components",
    csvSample: [
      ["Approach A", "Approaches", "1", "ea"],
      ["Deck", "Superstructure", "1", "ea"],
      ["Abutment A", "Substructure", "1", "ea"],
    ],
  },
};

export async function GET(
  req: Request,
  context: { params: Promise<{ kind: string }> },
) {
  await requireAdmin();
  const { kind } = await context.params;
  const def = TEMPLATES[kind];
  if (!def) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const sample = def.csvSample ?? [];

  if (format === "xlsx") {
    const buf = xlsxBufferFromHeaders(def.sheet, def.headers, sample);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${def.filename}.xlsx"`,
      },
    });
  }

  const csv = csvFromHeaders(def.headers, sample);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${def.filename}.csv"`,
    },
  });
}
