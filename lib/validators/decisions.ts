import { z } from "zod";

export const decisionOutcomeSchema = z.enum([
  "ACCEPT_ORAL",
  "ACCEPT_POSTER",
  "REJECT",
  "REVISIONS_REQUESTED",
  "WAITLIST",
]);

const isoDate = z.string().datetime({ offset: true });

/** Stored under events.settings.decisions (everything configurable per event). */
export const decisionSettingsSchema = z.object({
  /** DEC-03: weighted average ≥ this → Accept oral. */
  oralMinScore: z.number().min(0).max(100).nullable().default(null),
  /** DEC-03: weighted average ≥ this (and below oral) → Accept poster. */
  posterMinScore: z.number().min(0).max(100).nullable().default(null),
  /** DEC-03: what to do with abstracts below the poster cut-off. */
  belowCutoff: z.enum(["NONE", "WAITLIST", "REJECT"]).default("NONE"),
  /** DEC-03: skip abstracts with fewer completed reviews. */
  minCompletedReviews: z.number().int().min(1).max(10).default(1),
  /** DEC-03: leave disputed abstracts (REV-11 flag) for a manual decision. */
  skipDisputed: z.boolean().default(true),
  /** REV-11 / DEC-01: score gap that counts as disagreement. */
  disagreementThreshold: z.number().min(0).max(100).default(2),
  /** DEC-09: accepted abstracts unregistered after this are flagged. */
  registrationDueAt: isoDate.nullable().default(null),
});

export type DecisionSettings = z.infer<typeof decisionSettingsSchema>;

export const updateDecisionSettingsSchema = decisionSettingsSchema.partial().refine(
  (v) =>
    v.oralMinScore == null ||
    v.posterMinScore == null ||
    v.oralMinScore >= v.posterMinScore,
  { message: "The oral cut-off must be at or above the poster cut-off", path: ["oralMinScore"] },
);

export const decisionBoardQuerySchema = z.object({
  categoryId: z.string().optional(),
  submissionTypeId: z.string().optional(),
  minScore: z.coerce.number().optional(),
  maxScore: z.coerce.number().optional(),
  disputedOnly: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => (v === true || v === "true" ? true : undefined)),
  decision: z.union([decisionOutcomeSchema, z.literal("NONE")]).optional(),
  status: z.string().optional(),
  view: z.enum(["all", "pending_release", "unregistered", "declined"]).optional(),
  search: z.string().max(200).optional(),
});

export type DecisionBoardQuery = {
  categoryId?: string;
  submissionTypeId?: string;
  minScore?: number;
  maxScore?: number;
  disputedOnly?: boolean;
  decision?: z.infer<typeof decisionOutcomeSchema> | "NONE";
  status?: string;
  view?: "all" | "pending_release" | "unregistered" | "declined";
  search?: string;
};

export const setDecisionsSchema = z.object({
  submissionIds: z.array(z.string().min(1)).min(1).max(1000),
  /** null clears a decision that hasn't been released yet. */
  decision: decisionOutcomeSchema.nullable(),
  note: z.string().max(2000).optional(),
});

export const applyCutoffsSchema = z.object({
  mode: z.enum(["preview", "apply"]),
  categoryId: z.string().optional(),
});

export const releaseDecisionsSchema = z.object({
  /** Release one category (DEC-04) or, when omitted, the whole event. */
  categoryId: z.string().optional(),
  submissionIds: z.array(z.string().min(1)).max(1000).optional(),
  /** DEC-06: share anonymised reviewer comments with authors. */
  includeReviewerComments: z.boolean().default(false),
  /** DEC-07: new deadline for revisions requested in this release. */
  revisionDueAt: isoDate.optional(),
  sendEmails: z.boolean().default(true),
});

export const confirmationsActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("confirm"),
    submissionIds: z.array(z.string().min(1)).min(1).max(1000),
  }),
  z.object({
    action: z.literal("offer_waitlist"),
    declinedSubmissionId: z.string().min(1),
    sendEmail: z.boolean().default(true),
  }),
]);

export const slotResponseSchema = z.object({
  response: z.enum(["CONFIRMED", "DECLINED"]),
  reason: z.string().max(1000).optional(),
});

export const upsertEmailTemplateSchema = z.object({
  key: z.string().min(1).max(100),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(20000),
});

export const exportQuerySchema = z.object({
  format: z.enum(["docx", "html"]).default("docx"),
});

export type SetDecisionsInput = z.infer<typeof setDecisionsSchema>;
export type ApplyCutoffsInput = z.infer<typeof applyCutoffsSchema>;
export type ReleaseDecisionsInput = z.infer<typeof releaseDecisionsSchema>;
export type ConfirmationsActionInput = z.infer<typeof confirmationsActionSchema>;
export type SlotResponseInput = z.infer<typeof slotResponseSchema>;
export type UpsertEmailTemplateInput = z.infer<typeof upsertEmailTemplateSchema>;
export type ExportQueryInput = z.infer<typeof exportQuerySchema>;

