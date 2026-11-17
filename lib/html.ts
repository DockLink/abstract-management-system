/** Strip scripts and inline event handlers before rendering stored HTML. */
export function sanitizeRichHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("([^"]*)"|'([^']*)'|\S+)/gi, "");
}
