import { prisma } from "@/lib/db/prisma";
import ExcelJS from "exceljs";
import { getDecisionBoard } from "./board";

export async function generateSubmissionsExcel(
  orgId: string,
  eventId: string,
  allowedCategoryIds: string[] | null = null,
): Promise<Buffer> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { name: true, edition: true },
  });
  if (!event) throw new Error("Event not found");

  const board = await getDecisionBoard(orgId, eventId, {}, allowedCategoryIds);

  // Fetch full authors & affiliations for each submission to export rich details
  const subIds = board.rows.map((r) => r.id);
  const detailedSubmissions = await prisma.submission.findMany({
    where: { id: { in: subIds } },
    include: {
      authors: { orderBy: { sortOrder: "asc" } },
      affiliations: { orderBy: { number: "asc" } },
    },
  });

  const detailsMap = new Map(detailedSubmissions.map((s) => [s.id, s]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Abstract Management System";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Submissions & Decisions", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Ref No", key: "refNo", width: 15 },
    { header: "Title", key: "title", width: 40 },
    { header: "Category", key: "category", width: 22 },
    { header: "Submission Type", key: "subType", width: 20 },
    { header: "Preferred Type", key: "prefType", width: 16 },
    { header: "Submitter", key: "submitter", width: 24 },
    { header: "Submitter Email", key: "submitterEmail", width: 28 },
    { header: "Presenting Author", key: "presenter", width: 24 },
    { header: "All Authors", key: "allAuthors", width: 36 },
    { header: "Affiliations", key: "affiliations", width: 36 },
    { header: "Completed Reviews", key: "reviewsCount", width: 18 },
    { header: "Avg Score", key: "avgScore", width: 14 },
    { header: "Std Dev", key: "stdDev", width: 12 },
    { header: "Score Gap", key: "scoreGap", width: 12 },
    { header: "Disputed", key: "disputed", width: 12 },
    { header: "Chair Recommendation", key: "chairRec", width: 22 },
    { header: "Decision", key: "decision", width: 22 },
    { header: "Assigned Type", key: "assignedType", width: 16 },
    { header: "Decision Released", key: "released", width: 18 },
    { header: "Slot Response", key: "slotResponse", width: 16 },
    { header: "Registration Status", key: "regStatus", width: 20 },
    { header: "Overall Status", key: "status", width: 18 },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F766E" }, // Teal-700
  };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.height = 28;

  for (const row of board.rows) {
    const details = detailsMap.get(row.id);
    const authorsText = details
      ? details.authors
          .map((a) => `${a.initials} ${a.surname}${a.isPresenting ? " (*)" : ""}`)
          .join(", ")
      : "";

    const affiliationsText = details
      ? details.affiliations.map((aff) => `${aff.number}. ${aff.text}`).join("; ")
      : "";

    const regStatus =
      row.status === "CONFIRMED"
        ? "Registered & Paid"
        : row.isUnregistered
          ? "Unregistered (Overdue)"
          : row.status === "ACCEPTED"
            ? "Pending Registration"
            : "N/A";

    sheet.addRow({
      refNo: row.refNo || "---",
      title: row.title,
      category: row.categoryName || "Unassigned",
      subType: row.submissionTypeName,
      prefType: row.preferredPresentationType || "Either",
      submitter: row.submitter.fullName || "---",
      submitterEmail: row.submitter.email,
      presenter: row.presentingAuthor?.name || "---",
      allAuthors: authorsText,
      affiliations: affiliationsText,
      reviewsCount: row.scoreStats.completedReviews,
      avgScore: row.scoreStats.weightedAverageScore || 0,
      stdDev: row.scoreStats.standardDeviation || 0,
      scoreGap: row.scoreStats.scoreGap || 0,
      disputed: row.scoreStats.isDisputed ? "YES" : "No",
      chairRec: row.chairRecommendation ? row.chairRecommendation.replace("_", " ") : "---",
      decision: row.decision ? row.decision.replace("_", " ") : "Pending",
      assignedType: row.presentationType || "---",
      released: row.decisionReleasedAt ? "YES" : "No",
      slotResponse: row.slotResponse || "Pending",
      regStatus,
      status: row.status,
    });
  }

  // Format data rows
  sheet.eachRow((r, rowNumber) => {
    if (rowNumber > 1) {
      r.alignment = { vertical: "middle" };
      r.height = 22;
      // Alternate light zebra striping
      if (rowNumber % 2 === 0) {
        r.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      }
    }
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
