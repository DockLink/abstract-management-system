export type MemberCsvRow = {
  name: string;
  membershipNo: string | null;
  slmcNo: string | null;
  email: string | null;
};

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Expected headers (flexible aliases):
 * name, membership_number|membership_no, slmc_number|slmc_no, email
 */
export function parseMembersCsv(text: string): {
  rows: MemberCsvRow[];
  errors: string[];
} {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { rows: [], errors: ["CSV must include a header row and at least one data row"] };
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const idx = {
    name: headers.findIndex((h) => h === "name"),
    membershipNo: headers.findIndex(
      (h) => h === "membership_number" || h === "membership_no",
    ),
    slmcNo: headers.findIndex((h) => h === "slmc_number" || h === "slmc_no"),
    email: headers.findIndex((h) => h === "email"),
  };

  if (idx.name < 0) {
    return { rows: [], errors: ["CSV must include a 'name' column"] };
  }

  const rows: MemberCsvRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const name = cells[idx.name]?.trim() ?? "";
    if (!name) {
      errors.push(`Row ${i + 1}: name is required`);
      continue;
    }
    rows.push({
      name,
      membershipNo:
        idx.membershipNo >= 0 ? cells[idx.membershipNo]?.trim() || null : null,
      slmcNo: idx.slmcNo >= 0 ? cells[idx.slmcNo]?.trim() || null : null,
      email: idx.email >= 0 ? cells[idx.email]?.trim().toLowerCase() || null : null,
    });
  }

  return { rows, errors };
}
