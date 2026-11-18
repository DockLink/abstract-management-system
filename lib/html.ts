/** Strip scripts and inline event handlers before rendering stored HTML. */
export function sanitizeRichHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("([^"]*)"|'([^']*)'|\S+)/gi, "");
}

const FORBIDDEN_ABSTRACT_TAG_REGEX = /<\s*\/?\s*(table|thead|tbody|tfoot|tr|th|td|img|figure|figcaption|video|audio|iframe|object|embed|canvas)\b[^>]*>/gi;

/**
 * SUB-04: Block tables and images in the abstract body; allow bold, italic,
 * superscript, subscript, formatting, and Greek/medical symbols.
 */
export function validateAbstractHtml(html: string): { valid: boolean; forbiddenTags: string[] } {
  const matches = html.match(FORBIDDEN_ABSTRACT_TAG_REGEX);
  if (!matches || matches.length === 0) {
    return { valid: true, forbiddenTags: [] };
  }

  const tags = Array.from(
    new Set(
      matches.map((m) => {
        const cleaned = m.replace(/[<>/]/g, "").trim().split(/\s+/)[0]?.toLowerCase();
        return cleaned || m;
      }),
    ),
  );

  return { valid: false, forbiddenTags: tags };
}

/**
 * Strips disallowed elements (tables, images, media) while preserving allowed inline tags.
 */
export function sanitizeAbstractHtml(html: string): string {
  return sanitizeRichHtml(html).replace(FORBIDDEN_ABSTRACT_TAG_REGEX, "");
}

/**
 * SUB-03: Word counter across text/html content, excluding HTML markup.
 * Title and keywords are excluded as per SUB-03 requirement.
 */
export function countWordsInHtml(html: string): number {
  if (!html) return 0;
  // Replace HTML tags with a single space
  const stripped = html.replace(/<[^>]*>/g, " ");
  // Replace HTML entities like &nbsp;
  const decoded = stripped
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  const words = decoded.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

/**
 * Compute total word count across all sections in the abstract body.
 */
export function countAbstractBodyWords(abstractBody: Record<string, unknown> | null | undefined): number {
  if (!abstractBody || typeof abstractBody !== "object") return 0;
  let total = 0;
  for (const value of Object.values(abstractBody)) {
    if (typeof value === "string") {
      total += countWordsInHtml(value);
    }
  }
  return total;
}
