export const SEMANTIC_CHART_COLORS = {
  primary: "hsl(174 62% 35%)",
  success: "hsl(152 55% 38%)",
  warning: "hsl(38 92% 50%)",
  destructive: "hsl(0 72% 51%)",
  info: "hsl(210 80% 55%)",
} as const;

export const CHART_PALETTE = [
  SEMANTIC_CHART_COLORS.primary,
  SEMANTIC_CHART_COLORS.success,
  SEMANTIC_CHART_COLORS.info,
  SEMANTIC_CHART_COLORS.warning,
  SEMANTIC_CHART_COLORS.destructive,
];

const STATUS_COLOR: Record<string, string> = {
  draft: SEMANTIC_CHART_COLORS.info,
  submitted: SEMANTIC_CHART_COLORS.primary,
  pending: SEMANTIC_CHART_COLORS.warning,
  under_review: SEMANTIC_CHART_COLORS.warning,
  accepted: SEMANTIC_CHART_COLORS.success,
  rejected: SEMANTIC_CHART_COLORS.destructive,
  withdrawn: SEMANTIC_CHART_COLORS.info,
};

export function colorForSubmissionStatus(status: string, index: number): string {
  const key = status.toLowerCase().replace(/\s+/g, "_");
  return STATUS_COLOR[key] ?? CHART_PALETTE[index % CHART_PALETTE.length];
}
