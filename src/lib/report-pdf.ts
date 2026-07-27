import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import {
  formatAssetType,
  formatAssetRoadHeadline,
  formatLevel,
  formatRoadWithParentCode,
  formatStatus,
} from "@/lib/inspection";
import { absolutePhotoPath } from "@/lib/paths";
import { severityLabel } from "@/lib/severities";
import { formatAppPattern } from "@/lib/date-time";
import type {
  FormPayload,
  InspectionTemplate,
} from "@/lib/inspection-template-types";
import {
  fieldFilled,
  mediaKey,
  parseComponentNotes,
  parseMeasurementList,
} from "@/lib/inspection-template-types";

const GREEN = "#004825";
const GREEN_MID = "#00994d";
const INK = "#1a1a1a";
const MUTED = "#5c6670";
const RULE = "#c5cdd4";
const ROW_ALT = "#f6faef";
const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

export type ReportPdfAsset = {
  assetNumber: string;
  name: string;
  type: string;
  roadName: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  classification: string | null;
  subClassification?: string | null;
  parentAssetCode?: string | null;
  parentAssetName?: string | null;
  parentChainage: number | null;
  chainageFrom?: number | null;
  chainageTo?: number | null;
  notes: string | null;
};

export type ReportPdfCategory = {
  category: string;
  subcategory: string;
  comments: string | null;
};

export type ReportPdfDefect = {
  defectCode: string;
  description: string;
  comments: string | null;
  severity: string;
  category: string | null;
  subcategory: string | null;
  photoPath: string | null;
  comparisonPhotoPath: string | null;
};

export type ReportPdfInput = {
  inspectionId: string;
  level: string;
  status: string;
  inspectedAt: Date;
  submittedAt: Date;
  approvedAt: Date | null;
  generalComments: string | null;
  titleLabel: string;
  inspectorName: string;
  /** Optional credential line under inspector name (reg / L1–L2) */
  inspectorDetail?: string | null;
  approverName: string | null;
  approverDetail?: string | null;
  reviewerName?: string | null;
  reviewerDetail?: string | null;
  reviewedAt?: Date | null;
  asset: ReportPdfAsset;
  categories: ReportPdfCategory[];
  defects: ReportPdfDefect[];
  template?: InspectionTemplate | null;
  formPayload?: FormPayload | null;
  /** When set, only these defects (and no element checklist) — scope export */
  scopeOnly?: boolean;
  generatedByName?: string;
  /** Include form/section photos (default true) */
  includeFormPhotos?: boolean;
};

function brandLogoPath() {
  return path.join(process.cwd(), "public", "brand", "ventia-logo.png");
}

async function loadJpeg(relativePath: string | null): Promise<Buffer | null> {
  if (!relativePath) return null;
  try {
    const abs = absolutePhotoPath(relativePath);
    if (!fs.existsSync(abs)) return null;
    return await sharp(abs)
      .rotate()
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

function isLevel2(level: string) {
  return /level[_\s-]*2/i.test(level) || level === "LEVEL_2";
}

export async function buildInspectionPdf(
  input: ReportPdfInput,
): Promise<Buffer> {
  const defectPhotos = await Promise.all(
    input.defects.map(async (d) => ({
      id: d.defectCode,
      current: await loadJpeg(d.photoPath),
      prior: await loadJpeg(d.comparisonPhotoPath),
    })),
  );
  const photoByCode = new Map(
    defectPhotos.map((p) => [p.id, p] as const),
  );

  const includeFormPhotos = input.includeFormPhotos !== false;
  const formMediaBuffers = new Map<string, Buffer>();
  if (includeFormPhotos && input.formPayload?.media) {
    for (const items of Object.values(input.formPayload.media)) {
      for (const item of items) {
        if (!item.path || formMediaBuffers.has(item.path)) continue;
        const buf = await loadJpeg(item.path);
        if (buf) formMediaBuffers.set(item.path, buf);
      }
    }
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGIN + 6, bottom: 52, left: MARGIN, right: MARGIN },
      info: {
        Title: `${input.asset.assetNumber} — ${formatLevel(input.level)} Inspection Report`,
        Author: "VenInspect",
        Subject: input.titleLabel,
        Creator: "VenInspect",
      },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const generatedAt = new Date();
    const generatedBy =
      input.generatedByName?.trim() || input.inspectorName;

    const ensureSpace = (needed: number) => {
      if (doc.y + needed > PAGE_H - 56) {
        doc.addPage();
      }
    };

    const sectionTitle = (title: string) => {
      ensureSpace(28);
      doc.moveDown(0.4);
      const y = doc.y;
      doc.rect(MARGIN, y, 3, 12).fill(GREEN_MID);
      doc
        .fillColor(GREEN)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(title.toUpperCase(), MARGIN + 10, y);
      doc
        .moveTo(MARGIN, y + 16)
        .lineTo(PAGE_W - MARGIN, y + 16)
        .strokeColor(GREEN)
        .lineWidth(1)
        .stroke();
      doc.y = y + 22;
    };

    const metaRow = (pairs: [string, string][]) => {
      const colW = CONTENT_W / 2;
      let y = doc.y;
      for (let i = 0; i < pairs.length; i += 2) {
        ensureSpace(28);
        y = doc.y;
        const left = pairs[i];
        const right = pairs[i + 1];
        const drawCell = (pair: [string, string] | undefined, x: number) => {
          if (!pair) return;
          doc
            .fillColor(MUTED)
            .font("Helvetica")
            .fontSize(8)
            .text(pair[0], x, y, { width: colW - 8 });
          doc
            .fillColor(INK)
            .font("Helvetica-Bold")
            .fontSize(9.5)
            .text(pair[1] || "—", x, y + 11, { width: colW - 8 });
        };
        drawCell(left, MARGIN);
        drawCell(right, MARGIN + colW);
        doc.y = y + 28;
      }
    };

    // —— Header block (Asset Vision–style) ——
    const logoPath = brandLogoPath();
    if (fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, PAGE_W - MARGIN - 110, 18, {
          fit: [110, 36],
          align: "right",
        });
      } catch {
        /* logo optional */
      }
    }

    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(8)
      .text("STRUCTURES INSPECTION DETAIL", MARGIN, 18);

    const levelLabel = formatLevel(input.level);
    const statusWord = formatStatus(input.status);
    doc
      .fillColor(GREEN)
      .font("Helvetica-Bold")
      .fontSize(16)
      .text(
        input.scopeOnly
          ? `Scope Export — ${levelLabel}`
          : `${levelLabel} Inspection${/complete|approved|submitted/i.test(statusWord) ? " Completed" : ""}`,
        MARGIN,
        34,
        { width: CONTENT_W - 120 },
      );

    doc
      .fillColor(INK)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(
        formatAssetRoadHeadline({
          assetNumber: input.asset.assetNumber,
          roadName: input.asset.roadName,
          parentAssetCode: input.asset.parentAssetCode,
        }),
        MARGIN,
        doc.y + 4,
        { width: CONTENT_W },
      );
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(9)
      .text(
        [
          input.asset.name,
          formatAssetType(input.asset.type),
          input.asset.classification,
        ]
          .filter(Boolean)
          .join("  ·  "),
        { width: CONTENT_W },
      );

    doc.y += 8;
    doc
      .moveTo(MARGIN, doc.y)
      .lineTo(PAGE_W - MARGIN, doc.y)
      .strokeColor(RULE)
      .lineWidth(0.8)
      .stroke();
    doc.y += 10;

    metaRow([
      [
        "Road / location",
        [
          formatRoadWithParentCode(
            input.asset.roadName,
            input.asset.parentAssetCode,
          ),
          input.asset.location,
        ]
          .filter(Boolean)
          .join(" — "),
      ],
      ["Asset type", formatAssetType(input.asset.type, input.asset.subClassification)],
      ["Inspected", formatAppPattern(input.inspectedAt, "dd/MM/yyyy HH:mm")],
      ["Inspector", input.inspectorName],
      ...(input.inspectorDetail
        ? ([["Inspector credentials", input.inspectorDetail]] as [string, string][])
        : []),
      ["Status", statusWord],
      ["Inspection level", levelLabel],
      ...(input.approverName
        ? ([
            ["Approved by (Level 2)", input.approverName],
            ...(input.approverDetail
              ? ([["Approver credentials", input.approverDetail]] as [string, string][])
              : []),
            [
              "Approved",
              input.approvedAt
                ? formatAppPattern(input.approvedAt, "dd/MM/yyyy HH:mm")
                : "—",
            ],
          ] as [string, string][])
        : []),
      ...(input.reviewerName
        ? ([
            ["Reviewed by", input.reviewerName],
            ...(input.reviewerDetail
              ? ([["Reviewer credentials", input.reviewerDetail]] as [string, string][])
              : []),
            [
              "Reviewed",
              input.reviewedAt
                ? formatAppPattern(input.reviewedAt, "dd/MM/yyyy HH:mm")
                : "—",
            ],
          ] as [string, string][])
        : []),
      ...(input.asset.latitude != null && input.asset.longitude != null
        ? ([
            [
              "Coordinates",
              `${input.asset.latitude.toFixed(6)}, ${input.asset.longitude.toFixed(6)}`,
            ],
            [
              "Chainage",
              (() => {
                const from =
                  input.asset.chainageFrom ?? input.asset.parentChainage;
                const to = input.asset.chainageTo;
                if (from != null && to != null) return `${from} – ${to}`;
                if (from != null) return String(from);
                if (to != null) return String(to);
                return "—";
              })(),
            ],
          ] as [string, string][])
        : []),
    ]);

    if (input.generalComments && !input.scopeOnly) {
      sectionTitle("Comments");
      doc
        .fillColor(INK)
        .font("Helvetica")
        .fontSize(9.5)
        .text(input.generalComments, MARGIN, doc.y, {
          width: CONTENT_W,
          lineGap: 2,
        });
    }

    const values = input.formPayload?.values ?? {};
    const template = input.template;

    // —— Template form pages (L1 checklist / L2 sheets) ——
    if (!input.scopeOnly && template) {
      for (const page of template.pages) {
        if (page.builtin === "defects" || page.builtin === "photos") continue;

        const sections = page.sections.filter((sec) => {
          if (!sec.assetTypes || sec.assetTypes.length === 0) return true;
          return sec.assetTypes.includes(input.asset.type);
        });
        if (sections.length === 0) continue;

        sectionTitle(page.title);

        for (const sec of sections) {
          ensureSpace(28);
          doc
            .fillColor(GREEN)
            .font("Helvetica-Bold")
            .fontSize(9.5)
            .text(sec.title, MARGIN, doc.y + 2);
          doc.y += 4;

          const colLabel = 180;
          const colVal = CONTENT_W - colLabel;
          const hy = doc.y;
          doc.rect(MARGIN, hy, CONTENT_W, 14).fill(GREEN);
          doc
            .fillColor("#ffffff")
            .font("Helvetica-Bold")
            .fontSize(8)
            .text("Item", MARGIN + 6, hy + 3.5, { width: colLabel - 8 });
          doc.text("Result / value", MARGIN + colLabel + 4, hy + 3.5, {
            width: colVal - 8,
          });
          doc.y = hy + 14;

          sec.fields.forEach((field, idx) => {
            let result = values[field.id]?.trim() || "—";
            if (field.type === "component_table" && values[field.id]) {
              try {
                const rows = JSON.parse(values[field.id]) as {
                  name?: string;
                  qty?: string;
                  notes?: string;
                  cs1?: string;
                  cs2?: string;
                  cs3?: string;
                  cs4?: string;
                }[];
                if (Array.isArray(rows)) {
                  result =
                    rows
                      .map(
                        (r) =>
                          `${r.name ?? "?"} qty=${r.qty ?? ""} CS=${[r.cs1, r.cs2, r.cs3, r.cs4].join("/")}${r.notes ? ` — ${r.notes}` : ""}`,
                      )
                      .join("\n") || "—";
                }
              } catch {
                /* keep */
              }
            } else if (field.type === "measurement_list") {
              const rows = parseMeasurementList(values[field.id]);
              result =
                rows
                  .filter((r) => r.value.trim())
                  .map((r) => `${r.label || r.id}: ${r.value} m`)
                  .join("; ") || "—";
            } else if (field.type === "component_notes") {
              const rows = parseComponentNotes(values[field.id]);
              result =
                rows
                  .map((r) => `${r.label}: ${r.notes.trim() || "—"}`)
                  .join("\n") || "—";
            }
            const textH = Math.max(
              16,
              doc.heightOfString(result, {
                width: colVal - 10,
                lineGap: 1,
              }) + 8,
              doc.heightOfString(field.label, {
                width: colLabel - 10,
                lineGap: 1,
              }) + 8,
            );
            ensureSpace(textH + 2);
            const y = doc.y;
            if (idx % 2 === 0) {
              doc.rect(MARGIN, y, CONTENT_W, textH).fill(ROW_ALT);
            }
            doc
              .fillColor(INK)
              .font("Helvetica")
              .fontSize(8.5)
              .text(field.label, MARGIN + 6, y + 4, {
                width: colLabel - 10,
              });
            doc.text(result, MARGIN + colLabel + 4, y + 4, {
              width: colVal - 10,
              lineGap: 1,
            });
            doc
              .moveTo(MARGIN, y + textH)
              .lineTo(PAGE_W - MARGIN, y + textH)
              .strokeColor(RULE)
              .lineWidth(0.4)
              .stroke();
            doc.y = y + textH;
          });

          // Form / section photographs for this section
          if (includeFormPhotos && input.formPayload?.media) {
            const mediaEntries: { label: string; path: string }[] = [];
            const sectionItems = input.formPayload.media[sec.id] ?? [];
            if (
              sec.allowPhotos &&
              sec.includePhotosInReport !== false
            ) {
              for (const item of sectionItems) {
                mediaEntries.push({
                  label: item.caption || sec.title,
                  path: item.path,
                });
              }
            }
            for (const field of sec.fields) {
              if (!field.allowPhotos || field.includePhotosInReport === false) {
                continue;
              }
              const key = mediaKey(sec.id, field.id);
              for (const item of input.formPayload.media[key] ?? []) {
                mediaEntries.push({
                  label: item.caption || field.label,
                  path: item.path,
                });
              }
            }
            if (mediaEntries.length > 0) {
              doc.moveDown(0.2);
              doc
                .fillColor(MUTED)
                .font("Helvetica-Oblique")
                .fontSize(8)
                .text("Section photographs", MARGIN, doc.y);
              doc.moveDown(0.2);
              for (const entry of mediaEntries) {
                const buf = formMediaBuffers.get(entry.path);
                if (!buf) continue;
                ensureSpace(130);
                const imgY = doc.y;
                try {
                  doc.image(buf, MARGIN, imgY, {
                    fit: [CONTENT_W, 110],
                    align: "center",
                    valign: "center",
                  });
                  doc
                    .fillColor(MUTED)
                    .fontSize(7)
                    .text(entry.label, MARGIN, imgY + 112, {
                      width: CONTENT_W,
                    });
                  doc.y = imgY + 124;
                } catch {
                  /* skip */
                }
              }
            }
          }

          doc.moveDown(0.35);
        }
      }
    } else if (!input.scopeOnly && input.categories.length > 0) {
      // Legacy category comments fallback
      sectionTitle(
        isLevel2(input.level)
          ? "Component / element comments"
          : "Inspection checklist",
      );

      const grouped = new Map<string, ReportPdfCategory[]>();
      for (const c of input.categories) {
        const list = grouped.get(c.category) ?? [];
        list.push(c);
        grouped.set(c.category, list);
      }

      const colSub = 150;
      const colResult = CONTENT_W - colSub;

      for (const [cat, rows] of grouped) {
        ensureSpace(36);
        doc
          .fillColor(GREEN)
          .font("Helvetica-Bold")
          .fontSize(9.5)
          .text(cat, MARGIN, doc.y + 4);
        doc.y += 2;

        ensureSpace(18);
        const hy = doc.y;
        doc.rect(MARGIN, hy, CONTENT_W, 14).fill(GREEN);
        doc
          .fillColor("#ffffff")
          .font("Helvetica-Bold")
          .fontSize(8)
          .text("Element", MARGIN + 6, hy + 3.5, { width: colSub - 8 });
        doc.text("Result / comments", MARGIN + colSub + 4, hy + 3.5, {
          width: colResult - 8,
        });
        doc.y = hy + 14;

        rows.forEach((row, idx) => {
          const result = row.comments?.trim() || "—";
          const textH = Math.max(
            16,
            doc.heightOfString(result, {
              width: colResult - 10,
              lineGap: 1,
            }) + 8,
          );
          ensureSpace(textH + 2);
          const y = doc.y;
          if (idx % 2 === 0) {
            doc.rect(MARGIN, y, CONTENT_W, textH).fill(ROW_ALT);
          }
          doc
            .fillColor(INK)
            .font("Helvetica")
            .fontSize(8.5)
            .text(row.subcategory, MARGIN + 6, y + 4, {
              width: colSub - 10,
            });
          doc.text(result, MARGIN + colSub + 4, y + 4, {
            width: colResult - 10,
            lineGap: 1,
          });
          doc
            .moveTo(MARGIN, y + textH)
            .lineTo(PAGE_W - MARGIN, y + textH)
            .strokeColor(RULE)
            .lineWidth(0.4)
            .stroke();
          doc.y = y + textH;
        });
        doc.moveDown(0.35);
      }
    }

    // —— Defects (L2 treatment-style table + detail cards) ——
    if (input.defects.length > 0) {
      sectionTitle(
        input.scopeOnly
          ? "Scoped defects"
          : isLevel2(input.level)
            ? "Structure defect & treatment"
            : "Defects",
      );

      // Summary table
      const cols = [
        { key: "n", label: "No.", w: 28 },
        { key: "code", label: "Code", w: 72 },
        { key: "loc", label: "Location", w: 100 },
        { key: "sev", label: "Severity", w: 58 },
        { key: "desc", label: "Description", w: CONTENT_W - 28 - 72 - 100 - 58 },
      ] as const;

      ensureSpace(20);
      let y = doc.y;
      doc.rect(MARGIN, y, CONTENT_W, 14).fill(GREEN);
      let x = MARGIN;
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.5);
      for (const c of cols) {
        doc.text(c.label, x + 3, y + 3.5, { width: c.w - 4 });
        x += c.w;
      }
      doc.y = y + 14;

      input.defects.forEach((d, i) => {
        const loc = [d.category, d.subcategory].filter(Boolean).join(" / ") || "—";
        const desc = d.description || "—";
        const rowH = Math.max(
          18,
          doc.heightOfString(desc, { width: cols[4].w - 6, lineGap: 1 }) + 8,
        );
        ensureSpace(rowH + 2);
        y = doc.y;
        if (i % 2 === 0) doc.rect(MARGIN, y, CONTENT_W, rowH).fill(ROW_ALT);
        doc.fillColor(INK).font("Helvetica").fontSize(8);
        const vals = [
          String(i + 1),
          d.defectCode,
          loc,
          severityLabel(d.severity),
          desc,
        ];
        x = MARGIN;
        vals.forEach((v, ci) => {
          doc.text(v, x + 3, y + 3, {
            width: cols[ci].w - 6,
            lineGap: 1,
          });
          x += cols[ci].w;
        });
        doc
          .moveTo(MARGIN, y + rowH)
          .lineTo(PAGE_W - MARGIN, y + rowH)
          .strokeColor(RULE)
          .lineWidth(0.4)
          .stroke();
        doc.y = y + rowH;
      });

      // Detail + photos
      sectionTitle("Photographic record");
      for (const d of input.defects) {
        const photos = photoByCode.get(d.defectCode);
        const hasImg = Boolean(photos?.current || photos?.prior);
        ensureSpace(hasImg ? 160 : 70);

        const boxY = doc.y;
        doc
          .roundedRect(MARGIN, boxY, CONTENT_W, 2, 0)
          .strokeColor(GREEN_MID)
          .lineWidth(1.2)
          .stroke();

        doc
          .fillColor(GREEN)
          .font("Helvetica-Bold")
          .fontSize(10)
          .text(d.defectCode, MARGIN, boxY + 8);
        doc
          .fillColor(MUTED)
          .font("Helvetica")
          .fontSize(8)
          .text(
            `${severityLabel(d.severity)}${[d.category, d.subcategory].filter(Boolean).length ? `  ·  ${[d.category, d.subcategory].filter(Boolean).join(" / ")}` : ""}`,
            MARGIN + 90,
            boxY + 10,
            { width: CONTENT_W - 90 },
          );

        doc
          .fillColor(INK)
          .font("Helvetica")
          .fontSize(9)
          .text(d.description, MARGIN, boxY + 24, {
            width: CONTENT_W,
            lineGap: 1.5,
          });
        if (d.comments?.trim()) {
          doc
            .fillColor(MUTED)
            .fontSize(8.5)
            .text(d.comments, MARGIN, doc.y + 2, { width: CONTENT_W });
        }

        const imgY = doc.y + 8;
        const imgH = 120;
        const imgW = hasImg && photos?.prior && photos?.current ? (CONTENT_W - 12) / 2 : CONTENT_W;

        if (photos?.prior) {
          try {
            doc.image(photos.prior, MARGIN, imgY, {
              fit: [imgW, imgH],
              align: "center",
              valign: "center",
            });
            doc
              .fillColor(MUTED)
              .fontSize(7)
              .text("Prior", MARGIN, imgY + imgH + 2, { width: imgW });
          } catch {
            /* skip */
          }
        }
        if (photos?.current) {
          const ix =
            photos.prior && photos.current
              ? MARGIN + imgW + 12
              : MARGIN;
          try {
            doc.image(photos.current, ix, imgY, {
              fit: [imgW, imgH],
              align: "center",
              valign: "center",
            });
            doc
              .fillColor(MUTED)
              .fontSize(7)
              .text(
                photos.prior ? "Current" : "Photo",
                ix,
                imgY + imgH + 2,
                { width: imgW },
              );
          } catch {
            /* skip */
          }
        }

        if (hasImg) {
          doc.y = imgY + imgH + 16;
        } else {
          doc.y += 10;
        }
        doc.moveDown(0.3);
      }
    } else if (!input.scopeOnly) {
      sectionTitle("Defects");
      doc
        .fillColor(MUTED)
        .font("Helvetica")
        .fontSize(9.5)
        .text("No defects recorded.", MARGIN, doc.y);
    }

    // —— Closing (L1-style) ——
    if (!input.scopeOnly) {
      sectionTitle("Conclusion");
      doc
        .fillColor(INK)
        .font("Helvetica")
        .fontSize(9)
        .text(
          input.generalComments?.trim()
            ? input.generalComments
            : "Inspection completed. See checklist and defect sections above.",
          MARGIN,
          doc.y,
          { width: CONTENT_W },
        );
      doc.moveDown(1.4);
      ensureSpace(70);
      const sigY = doc.y;
      doc.fillColor(MUTED).fontSize(8).text("Inspector signature", MARGIN, sigY);
      doc
        .moveTo(MARGIN, sigY + 28)
        .lineTo(MARGIN + 200, sigY + 28)
        .strokeColor(RULE)
        .stroke();
      doc
        .fillColor(INK)
        .font("Helvetica")
        .fontSize(9)
        .text(input.inspectorName, MARGIN, sigY + 32);
      if (input.inspectorDetail) {
        doc
          .fillColor(MUTED)
          .fontSize(7)
          .text(input.inspectorDetail, MARGIN, sigY + 44, { width: 200 });
      }

      if (input.approverName) {
        doc
          .fillColor(MUTED)
          .fontSize(8)
          .text("Approved by (Level 2)", MARGIN + 240, sigY);
        doc
          .moveTo(MARGIN + 240, sigY + 28)
          .lineTo(MARGIN + 440, sigY + 28)
          .strokeColor(RULE)
          .stroke();
        doc
          .fillColor(INK)
          .fontSize(9)
          .text(input.approverName, MARGIN + 240, sigY + 32);
        if (input.approverDetail) {
          doc
            .fillColor(MUTED)
            .fontSize(7)
            .text(input.approverDetail, MARGIN + 240, sigY + 44, { width: 200 });
        }
      }
      doc.y = sigY + (input.inspectorDetail || input.approverDetail ? 58 : 52);

      if (input.reviewerName) {
        ensureSpace(40);
        const revY = doc.y + 8;
        doc
          .fillColor(MUTED)
          .fontSize(8)
          .text("Second review", MARGIN, revY);
        doc
          .moveTo(MARGIN, revY + 28)
          .lineTo(MARGIN + 200, revY + 28)
          .strokeColor(RULE)
          .stroke();
        doc
          .fillColor(INK)
          .fontSize(9)
          .text(`Reviewed by ${input.reviewerName}`, MARGIN, revY + 32);
        if (input.reviewerDetail) {
          doc
            .fillColor(MUTED)
            .fontSize(7)
            .text(input.reviewerDetail, MARGIN, revY + 44, { width: 280 });
        }
        doc.y = revY + (input.reviewerDetail ? 56 : 48);
      }
    }

    // Headers / footers / page numbers after content (avoids page-break recursion)
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const prevBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      doc.save();
      doc.rect(0, 0, PAGE_W, 8).fill(GREEN);

      const footerY = PAGE_H - 28;
      doc
        .moveTo(MARGIN, footerY - 10)
        .lineTo(PAGE_W - MARGIN, footerY - 10)
        .strokeColor(RULE)
        .lineWidth(0.6)
        .stroke();
      doc.fillColor(MUTED).fontSize(7).font("Helvetica");
      doc.text("Inspection Detail", MARGIN, footerY - 6, {
        lineBreak: false,
        width: 70,
      });
      doc.fillColor(GREEN).font("Helvetica-Bold");
      doc.text("VENINSPECT", MARGIN + 72, footerY - 6, {
        lineBreak: false,
        width: 70,
      });
      doc.fillColor(MUTED).font("Helvetica");
      doc.text(
        `ID ${input.inspectionId.slice(-8).toUpperCase()} · ${generatedBy} ${formatAppPattern(generatedAt, "dd/MM/yyyy H:mm")}`,
        MARGIN + 145,
        footerY - 6,
        { lineBreak: false, width: CONTENT_W - 200 },
      );
      doc.text(`${i + 1} of ${range.count}`, PAGE_W - MARGIN - 40, footerY - 6, {
        lineBreak: false,
        width: 40,
        align: "right",
      });
      doc.restore();
      doc.page.margins.bottom = prevBottom;
    }

    doc.end();
  });
}

export function pdfFilename(input: {
  assetNumber: string;
  inspectedAt: Date;
  level: string;
  scopeOnly?: boolean;
}) {
  const date = formatAppPattern(input.inspectedAt, "ddMMyyyy");
  const level = formatLevel(input.level).replace(/\s+/g, "");
  const kind = input.scopeOnly ? "Scope" : "InspectionDetailReport";
  return `${input.assetNumber}_${level}_${kind}_${date}.pdf`;
}
