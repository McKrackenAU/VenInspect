import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canViewInspection } from "@/lib/inspection-access";
import { absolutePhotoPath, sanitizePathSegment } from "@/lib/paths";
import { getTemplateForLevel } from "@/lib/inspection-templates";
import { parseFormPayload } from "@/lib/inspection-templates";
import { buildInspectionPdf } from "@/lib/report-pdf";
import { getExportConfig } from "@/lib/export-config";
import { defectMatchesConditionStates } from "@/lib/severities";
import { formatPersonCredential } from "@/lib/report-people";
import {
  buildExportPhotoPool,
  filterExportPhotosByCondition,
  mergeExportPhotoOrder,
} from "@/lib/export-photos";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Minimal ZIP (store only) for client export packs. */
function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function zipStore(files: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const nameBuf = Buffer.from(f.name.replace(/\\/g, "/"), "utf8");
    const crc = crc32(f.data);
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(f.data.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);
    parts.push(local, f.data);

    const cen = Buffer.alloc(46 + nameBuf.length);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8);
    cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(f.data.length, 20);
    cen.writeUInt32LE(f.data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    nameBuf.copy(cen, 46);
    central.push(cen);
    offset += local.length + f.data.length;
  }
  const centralSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, ...central, end]);
}

function folderName(component: string | null | undefined, defectCode?: string) {
  const comp = sanitizePathSegment(component || "Uncategorised", "Uncategorised");
  if (defectCode) {
    return `${comp}__${sanitizePathSegment(defectCode, "defect")}`;
  }
  return comp;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { id } = await context.params;
  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: {
      asset: true,
      createdBy: true,
      approvedBy: true,
      reviewedBy: true,
      defects: {
        orderBy: [{ sortOrder: "asc" }, { defectCode: "asc" }],
        include: { photos: { orderBy: { sortOrder: "asc" } } },
      },
      categories: { orderBy: [{ category: "asc" }, { subcategory: "asc" }] },
      permitChecks: true,
    },
  });
  if (!inspection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canViewInspection(user, inspection)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const exportCfg = getExportConfig();
  const severityParam = req.nextUrl.searchParams.get("severities");
  const severityFilter = severityParam
    ? severityParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : exportCfg.defaultConditionStates;

  const defects = inspection.defects.filter((d) =>
    defectMatchesConditionStates(d.severity, severityFilter),
  );

  const template = getTemplateForLevel(inspection.level);
  const formPayload = parseFormPayload(inspection.formPayload);
  const zipFiles: { name: string; data: Buffer }[] = [];

  if (exportCfg.includePdf) {
    const pdf = await buildInspectionPdf({
      inspectionId: inspection.id,
      level: inspection.level,
      status: inspection.status,
      inspectedAt: inspection.inspectedAt,
      submittedAt: inspection.submittedAt,
      approvedAt: inspection.approvedAt,
      generalComments: inspection.generalComments,
      titleLabel: inspection.titleLabel,
      inspectorName: inspection.createdBy.name,
      inspectorDetail: formatPersonCredential(inspection.createdBy),
      approverName: inspection.approvedBy?.name ?? null,
      approverDetail: inspection.approvedBy
        ? formatPersonCredential(inspection.approvedBy)
        : null,
      reviewerName:
        inspection.reviewStatus === "COMPLETED" && inspection.reviewedBy
          ? inspection.reviewedBy.name
          : null,
      reviewerDetail:
        inspection.reviewStatus === "COMPLETED" && inspection.reviewedBy
          ? formatPersonCredential(inspection.reviewedBy)
          : null,
      reviewedAt: inspection.reviewedAt,
      asset: inspection.asset,
      categories: inspection.categories,
      defects,
      formPayload,
      template,
      generatedByName: user.name,
      includeFormPhotos: exportCfg.includeFormPhotos,
    });
    zipFiles.push({ name: "Report.pdf", data: pdf });
  }

  const indexRows: Record<string, string | number>[] = [];
  const root = `${sanitizePathSegment(inspection.asset.assetNumber)}_${sanitizePathSegment(inspection.folderKey)}_ClientExport`;

  type PackPhoto = {
    key: string;
    zipName: string;
    absPath: string;
    index: Record<string, string | number>;
  };
  const packPhotos: PackPhoto[] = [];

  const pool = buildExportPhotoPool(
    inspection.defects,
    formPayload.media ?? {},
    {
      includeComparison: exportCfg.includeComparisonPhotos,
      // Always include general/section photos in the pack pool (report photos)
      includeFormPhotos: true,
      template,
    },
  );
  const filteredPool = filterExportPhotosByCondition(pool, severityFilter).filter(
    (p) => {
      if (p.group === "general") return true;
      return exportCfg.includePhotos;
    },
  );

  for (const p of filteredPool) {
    try {
      const abs = absolutePhotoPath(p.path);
      await fs.access(abs);
      const base = path.basename(p.path);
      const isGeneral = p.group === "general";
      const folder = isGeneral
        ? sanitizePathSegment(
            (p.detail || "General").replace(/[·/\\]+/g, "_"),
            "General",
          )
        : folderName(p.subcategory || p.category, p.defectCode);
      const zipName = isGeneral
        ? `GeneralPhotos/${folder}/${base}`
        : `Photos/${folder}/${base}`;
      packPhotos.push({
        key: p.key,
        zipName,
        absPath: abs,
        index: {
          Folder: isGeneral ? `GeneralPhotos/${folder}` : folder,
          Component: p.subcategory || p.category || p.detail || "General",
          "Defect code": p.defectCode ?? "",
          "Condition state": p.severity ?? "",
          Description: p.description ?? p.label,
          Comments: p.comments ?? "",
          "Photo file": base,
          "Asset number": inspection.asset.assetNumber,
          Inspection: inspection.titleLabel,
          Group: isGeneral ? "General" : "Defect",
        },
      });
    } catch {
      /* missing file */
    }
  }

  const orderParam = req.nextUrl.searchParams.get("photoOrder");
  const preferredOrder = orderParam
    ? orderParam.split("|").filter(Boolean)
    : mergeExportPhotoOrder(formPayload.exportPhotoOrder, filteredPool);
  const byKey = new Map(packPhotos.map((p) => [p.key, p]));
  const ordered: PackPhoto[] = [];
  for (const k of preferredOrder) {
    const p = byKey.get(k);
    if (p) {
      ordered.push(p);
      byKey.delete(k);
    }
  }
  // Any remaining: general first, then defect (pool order)
  for (const p of packPhotos) {
    if (byKey.has(p.key)) ordered.push(p);
  }

  for (const p of ordered) {
    try {
      const data = await fs.readFile(p.absPath);
      const seq = indexRows.length + 1;
      const { formatDotPhotoName } = await import("@/lib/dot-photo-register");
      const dotName = formatDotPhotoName({
        assetNumber: inspection.asset.assetNumber,
        takenAt: inspection.inspectedAt,
        sequence: seq,
      });
      const ext = path.extname(p.zipName) || ".webp";
      const renamed = p.zipName.includes("Photos/")
        ? p.zipName.replace(/\/[^/]+$/, `/${dotName}${ext}`)
        : p.zipName;
      zipFiles.push({ name: renamed, data });
      indexRows.push({
        ...p.index,
        "Pack sequence": seq,
        "DoT file name": `${dotName}${ext}`,
        "Photo file": path.basename(renamed),
      });
    } catch {
      /* skip */
    }
  }

  if (exportCfg.includePhotoIndex) {
    const ws = XLSX.utils.json_to_sheet(
      indexRows.length
        ? indexRows
        : [
            {
              Folder: "",
              Note: "No photos for selected condition states",
              "Asset number": inspection.asset.assetNumber,
              Inspection: inspection.titleLabel,
              "Condition states": severityFilter.join(", "),
            },
          ],
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Photo index");
    const xlsx = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    zipFiles.push({ name: "Photo_Index.xlsx", data: xlsx });
  }

  if (zipFiles.length === 0) {
    return NextResponse.json(
      { error: "Export configurator excluded all pack contents" },
      { status: 400 },
    );
  }

  const nested = zipFiles.map((f) => ({
    name: `${root}/${f.name}`,
    data: f.data,
  }));
  const zip = zipStore(nested);

  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${root}.zip"`,
    },
  });
}
