import { prisma } from "@/lib/db/prisma";
import { SubmissionStatus } from "@/app/generated/prisma/client";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Header,
  Footer,
  PageNumber,
} from "docx";
import { formatLongDate } from "@/lib/dates";

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

export async function generateAbstractBookDocx(
  orgId: string,
  eventId: string,
  includeAccepted = false,
): Promise<Buffer> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { organisation: true },
  });
  if (!event) throw new Error("Event not found");

  const statusFilter: SubmissionStatus[] = [SubmissionStatus.CONFIRMED];
  if (includeAccepted) {
    statusFilter.push(SubmissionStatus.ACCEPTED);
  }

  const submissions = await prisma.submission.findMany({
    where: {
      orgId,
      eventId,
      deletedAt: null,
      status: { in: statusFilter },
    },
    include: {
      category: true,
      submissionType: true,
      authors: { orderBy: { sortOrder: "asc" } },
      affiliations: { orderBy: { number: "asc" } },
    },
    orderBy: [
      { category: { name: "asc" } },
      { presentationType: "asc" },
      { refNo: "asc" },
    ],
  });

  // Group submissions by category
  const categoriesMap = new Map<string, typeof submissions>();
  for (const s of submissions) {
    const catName = s.category?.name || "General";
    if (!categoriesMap.has(catName)) {
      categoriesMap.set(catName, []);
    }
    categoriesMap.get(catName)!.push(s);
  }

  const sectionsChildren: (Paragraph)[] = [];

  // 1. Cover Page
  sectionsChildren.push(
    new Paragraph({ text: "", spacing: { before: 2000 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: event.name,
          bold: true,
          size: 48, // 24pt
          color: "1e293b",
        }),
      ],
      spacing: { after: 300 },
    }),
  );

  if (event.edition) {
    sectionsChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: event.edition,
            size: 32,
            color: "475569",
          }),
        ],
        spacing: { after: 400 },
      }),
    );
  }

  sectionsChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "ABSTRACT BOOK",
          bold: true,
          size: 36,
          color: "0f766e",
        }),
      ],
      spacing: { after: 600 },
    }),
  );

  const venueDateText = [
    event.venue,
    event.startsAt ? formatLongDate(event.startsAt) : null,
  ]
    .filter(Boolean)
    .join(" • ");

  if (venueDateText) {
    sectionsChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: venueDateText,
            italics: true,
            size: 24,
            color: "64748b",
          }),
        ],
        spacing: { after: 1200 },
      }),
    );
  }

  sectionsChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: event.organisation.name,
          bold: true,
          size: 24,
          color: "334155",
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // 2. Table of Contents / Index
  sectionsChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [
        new TextRun({
          text: "Table of Contents",
          bold: true,
          size: 36,
        }),
      ],
      spacing: { after: 400 },
    }),
  );

  for (const [catName, catSubmissions] of categoriesMap.entries()) {
    sectionsChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun({
            text: catName,
            bold: true,
            size: 26,
            color: "0f766e",
          }),
        ],
        spacing: { before: 300, after: 150 },
      }),
    );

    for (const sub of catSubmissions) {
      const presLabel = sub.presentationType ? `[${sub.presentationType}] ` : "";
      sectionsChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${sub.refNo || "---"}: `,
              bold: true,
              size: 20,
            }),
            new TextRun({
              text: `${presLabel}${sub.title}`,
              size: 20,
            }),
          ],
          spacing: { after: 100 },
        }),
      );
    }
  }

  sectionsChildren.push(new Paragraph({ children: [new PageBreak()] }));

  // 3. Abstracts Content
  for (const [catName, catSubmissions] of categoriesMap.entries()) {
    // Category Header
    sectionsChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: catName,
            bold: true,
            size: 34,
            color: "0f766e",
          }),
        ],
        spacing: { before: 400, after: 300 },
      }),
    );

    for (let i = 0; i < catSubmissions.length; i++) {
      const sub = catSubmissions[i];

      // Ref No and Presentation Type Header
      const metaLine = [
        sub.refNo,
        sub.presentationType ? `${sub.presentationType} Presentation` : null,
        sub.submissionType.name,
      ]
        .filter(Boolean)
        .join(" | ");

      sectionsChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: metaLine,
              bold: true,
              size: 18,
              color: "64748b",
            }),
          ],
          spacing: { before: 200, after: 100 },
        }),
      );

      // Title
      sectionsChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: sub.title,
              bold: true,
              size: 26,
              color: "0f172a",
            }),
          ],
          spacing: { after: 150 },
        }),
      );

      // Authors with Presenter Underlined and Superscript Affiliations
      const authorRuns: TextRun[] = [];
      sub.authors.forEach((author, aIdx) => {
        const name = `${author.initials} ${author.surname}`.trim();
        authorRuns.push(
          new TextRun({
            text: name,
            underline: author.isPresenting ? {} : undefined,
            bold: author.isPresenting,
            size: 20,
          }),
        );

        if (author.affiliationNos.length > 0) {
          authorRuns.push(
            new TextRun({
              text: author.affiliationNos.join(","),
              superScript: true,
              size: 16,
            }),
          );
        }

        if (aIdx < sub.authors.length - 1) {
          authorRuns.push(new TextRun({ text: ", ", size: 20 }));
        }
      });

      sectionsChildren.push(
        new Paragraph({
          children: authorRuns,
          spacing: { after: 120 },
        }),
      );

      // Affiliations
      if (sub.affiliations.length > 0) {
        const affRuns: TextRun[] = [];
        sub.affiliations.forEach((aff, affIdx) => {
          affRuns.push(
            new TextRun({
              text: `${aff.number}. `,
              superScript: true,
              size: 16,
              italics: true,
            }),
            new TextRun({
              text: aff.text,
              size: 18,
              italics: true,
              color: "475569",
            }),
          );
          if (affIdx < sub.affiliations.length - 1) {
            affRuns.push(new TextRun({ text: "  ", size: 18 }));
          }
        });

        sectionsChildren.push(
          new Paragraph({
            children: affRuns,
            spacing: { after: 200 },
          }),
        );
      }

      // Abstract Body Sections
      const bodyObj = (sub.abstractBody || {}) as Record<string, string>;
      const sectionKeys = Object.keys(bodyObj);

      if (sectionKeys.length > 0) {
        for (const key of sectionKeys) {
          const rawText = bodyObj[key];
          if (!rawText) continue;
          const clean = stripHtml(rawText);
          const headingLabel = key.charAt(0).toUpperCase() + key.slice(1);

          sectionsChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${headingLabel}: `,
                  bold: true,
                  size: 20,
                  color: "1e293b",
                }),
                new TextRun({
                  text: clean,
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
          );
        }
      }

      // Keywords
      if (sub.keywords && sub.keywords.length > 0) {
        sectionsChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "Keywords: ",
                bold: true,
                italics: true,
                size: 18,
                color: "64748b",
              }),
              new TextRun({
                text: sub.keywords.join(", "),
                italics: true,
                size: 18,
                color: "64748b",
              }),
            ],
            spacing: { before: 100, after: 300 },
          }),
        );
      }

      // Divider or Page Break between abstracts
      if (i < catSubmissions.length - 1) {
        sectionsChildren.push(
          new Paragraph({
            text: "───────────────────────────────────────────────",
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
          }),
        );
      }
    }

    sectionsChildren.push(new Paragraph({ children: [new PageBreak()] }));
  }

  const doc = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `${event.name} — Abstract Book`,
                    size: 16,
                    color: "94a3b8",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: "94a3b8",
                  }),
                ],
              }),
            ],
          }),
        },
        children: sectionsChildren,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export async function generateAbstractBookHtml(
  orgId: string,
  eventId: string,
  includeAccepted = false,
): Promise<string> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { organisation: true },
  });
  if (!event) throw new Error("Event not found");

  const statusFilter: SubmissionStatus[] = [SubmissionStatus.CONFIRMED];
  if (includeAccepted) statusFilter.push(SubmissionStatus.ACCEPTED);

  const submissions = await prisma.submission.findMany({
    where: {
      orgId,
      eventId,
      deletedAt: null,
      status: { in: statusFilter },
    },
    include: {
      category: true,
      submissionType: true,
      authors: { orderBy: { sortOrder: "asc" } },
      affiliations: { orderBy: { number: "asc" } },
    },
    orderBy: [
      { category: { name: "asc" } },
      { presentationType: "asc" },
      { refNo: "asc" },
    ],
  });

  const categoriesMap = new Map<string, typeof submissions>();
  for (const s of submissions) {
    const catName = s.category?.name || "General";
    if (!categoriesMap.has(catName)) categoriesMap.set(catName, []);
    categoriesMap.get(catName)!.push(s);
  }

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${event.name} — Abstract Book</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 20px; max-width: 800px; margin: 0 auto; }
    .cover { min-height: 80vh; display: flex; flex-direction: column; justify-content: center; text-align: center; page-break-after: always; }
    .cover h1 { font-size: 2.2rem; color: #0f172a; margin-bottom: 0.5rem; }
    .cover .edition { font-size: 1.3rem; color: #475569; margin-bottom: 1.5rem; }
    .cover .badge { display: inline-block; background: #0f766e; color: white; padding: 6px 16px; border-radius: 4px; font-weight: bold; font-size: 1.1rem; letter-spacing: 1px; margin-bottom: 2rem; }
    .cover .venue { font-style: italic; color: #64748b; margin-bottom: 3rem; }
    .toc { page-break-after: always; }
    .toc h2 { border-bottom: 2px solid #0f766e; padding-bottom: 8px; color: #0f766e; }
    .toc-item { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.95rem; }
    .category-section { page-break-before: always; }
    .category-title { color: #0f766e; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px; margin-top: 2rem; }
    .abstract-entry { margin-bottom: 2.5rem; border-bottom: 1px dashed #cbd5e1; padding-bottom: 2rem; }
    .abstract-meta { font-size: 0.85rem; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
    .abstract-title { font-size: 1.25rem; font-weight: bold; color: #0f172a; margin: 0 0 8px 0; }
    .presenter { text-decoration: underline; font-weight: 600; }
    .authors { font-size: 0.95rem; margin-bottom: 6px; }
    .affiliations { font-size: 0.85rem; font-style: italic; color: #475569; margin-bottom: 14px; }
    .abstract-body { font-size: 0.95rem; }
    .section-label { font-weight: bold; color: #1e293b; }
    .keywords { font-size: 0.85rem; font-style: italic; color: #64748b; margin-top: 10px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; background: #f1f5f9; padding: 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
    <span><strong>${event.name} — Abstract Book</strong> (${submissions.length} abstracts)</span>
    <button onclick="window.print()" style="background: #0f766e; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold;">Print / Save as PDF</button>
  </div>

  <div class="cover">
    <h1>${event.name}</h1>
    ${event.edition ? `<div class="edition">${event.edition}</div>` : ""}
    <div><span class="badge">ABSTRACT BOOK</span></div>
    ${event.venue ? `<div class="venue">${event.venue}</div>` : ""}
    <div style="font-weight: bold;">${event.organisation.name}</div>
  </div>

  <div class="toc">
    <h2>Table of Contents</h2>
`;

  for (const [catName, catSubmissions] of categoriesMap.entries()) {
    html += `<h3 style="color: #0f766e; margin-top: 1.5rem;">${catName}</h3>`;
    for (const sub of catSubmissions) {
      const pres = sub.presentationType ? `[${sub.presentationType}] ` : "";
      html += `<div class="toc-item"><span><strong>${sub.refNo || "---"}</strong> ${pres}${sub.title}</span></div>`;
    }
  }

  html += `</div>`;

  for (const [catName, catSubmissions] of categoriesMap.entries()) {
    html += `<div class="category-section"><h2 class="category-title">${catName}</h2>`;

    for (const sub of catSubmissions) {
      const metaLine = [
        sub.refNo,
        sub.presentationType ? `${sub.presentationType} Presentation` : null,
        sub.submissionType.name,
      ]
        .filter(Boolean)
        .join(" | ");

      html += `<div class="abstract-entry">
        <div class="abstract-meta">${metaLine}</div>
        <div class="abstract-title">${sub.title}</div>
        <div class="authors">`;

      const authorParts = sub.authors.map((a) => {
        const name = `${a.initials} ${a.surname}`.trim();
        const sup = a.affiliationNos.length > 0 ? `<sup>${a.affiliationNos.join(",")}</sup>` : "";
        if (a.isPresenting) {
          return `<span class="presenter">${name}</span>${sup}`;
        }
        return `<span>${name}</span>${sup}`;
      });

      html += `${authorParts.join(", ")}</div>`;

      if (sub.affiliations.length > 0) {
        html += `<div class="affiliations">`;
        html += sub.affiliations.map((aff) => `<sup>${aff.number}</sup> ${aff.text}`).join(" &nbsp;•&nbsp; ");
        html += `</div>`;
      }

      html += `<div class="abstract-body">`;
      const bodyObj = (sub.abstractBody || {}) as Record<string, string>;
      for (const [key, val] of Object.entries(bodyObj)) {
        if (!val) continue;
        const heading = key.charAt(0).toUpperCase() + key.slice(1);
        html += `<p><span class="section-label">${heading}:</span> ${stripHtml(val)}</p>`;
      }
      html += `</div>`;

      if (sub.keywords && sub.keywords.length > 0) {
        html += `<div class="keywords">Keywords: ${sub.keywords.join(", ")}</div>`;
      }

      html += `</div>`;
    }

    html += `</div>`;
  }

  html += `</body></html>`;
  return html;
}

