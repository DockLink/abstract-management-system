import { z } from "zod";

// --- Enums ---
export const reviewerInviteStatusSchema = z.enum(["PENDING", "ACCEPTED", "DECLINED"]);

export const reviewAssignmentStatusSchema = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CONFLICT",
]);

export const reviewRecommendationSchema = z.enum([
  "ACCEPT_ORAL",
  "ACCEPT_POSTER",
  "REJECT",
  "REVISE",
]);

// --- Reviewer Pool (REV-01, REV-02) ---
export const inviteReviewerSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(200).optional(),
  categoryIds: z.array(z.string()).optional().default([]),
  maxLoad: z.number().int().min(1).max(200).optional().default(20),
});

export const updateReviewerSchema = z.object({
  categoryIds: z.array(z.string()).optional(),
  maxLoad: z.number().int().min(1).max(200).optional(),
});

export const reviewerAcceptSchema = z.object({
  agreeToConfidentiality: z.literal(true, {
    message: "You must agree to confidentiality to accept",
  }),
});

// --- Rubric Criteria (REV-04) ---
export const createRubricCriterionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  scaleMin: z.number().int().min(0).default(1),
  scaleMax: z.number().int().min(1).default(5),
  weight: z.number().positive().default(1.0),
  sortOrder: z.number().int().optional().default(0),
}).refine((data) => data.scaleMax > data.scaleMin, {
  message: "scaleMax must be strictly greater than scaleMin",
  path: ["scaleMax"],
});

export const updateRubricCriterionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  scaleMin: z.number().int().min(0).optional(),
  scaleMax: z.number().int().min(1).optional(),
  weight: z.number().positive().optional(),
  sortOrder: z.number().int().optional(),
}).refine((data) => {
  if (data.scaleMin !== undefined && data.scaleMax !== undefined) {
    return data.scaleMax > data.scaleMin;
  }
  return true;
}, {
  message: "scaleMax must be strictly greater than scaleMin",
  path: ["scaleMax"],
});

export const reorderRubricCriteriaSchema = z.object({
  criteria: z.array(
    z.object({
      id: z.string().min(1),
      sortOrder: z.number().int(),
    }),
  ).min(1),
});

// --- Assignments (REV-06, REV-13) ---
export const createAssignmentSchema = z.object({
  submissionId: z.string().min(1),
  reviewerId: z.string().min(1),
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
});

export const batchAssignSchema = z.object({
  assignments: z.array(createAssignmentSchema).min(1),
});

export const bulkCategoryAssignSchema = z.object({
  categoryId: z.string().min(1),
  reviewerIds: z.array(z.string().min(1)).min(1),
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
});

export const autoAssignSchema = z.object({
  reviewersPerAbstract: z.number().int().min(1).max(10).optional().default(2),
  categoryId: z.string().optional().nullable(),
  balanceLoad: z.boolean().optional().default(true),
  skipSameInstitution: z.boolean().optional().default(true),
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
});

export const reassignAssignmentSchema = z.object({
  newReviewerId: z.string().min(1),
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
});

// --- Conflict of Interest (REV-07) ---
export const declareConflictSchema = z.object({
  reason: z.string().min(3).max(1000),
});

// --- Scoring & Reviews (REV-04, REV-05, REV-08) ---
export const scoreInputSchema = z.object({
  criterionId: z.string().min(1),
  score: z.number(),
});

export const saveReviewSchema = z.object({
  isDraft: z.boolean().default(true),
  scores: z.array(scoreInputSchema).optional().default([]),
  recommendation: reviewRecommendationSchema.optional().nullable(),
  commentAuthor: z.string().max(5000).optional().nullable(),
  commentCommittee: z.string().max(5000).optional().nullable(),
});

// --- Queries ---
export const listAssignmentsQuerySchema = z.object({
  submissionId: z.string().optional(),
  reviewerId: z.string().optional(),
  status: reviewAssignmentStatusSchema.optional(),
  categoryId: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const scoresTableQuerySchema = z.object({
  categoryId: z.string().optional(),
  disagreementThreshold: z.coerce.number().positive().optional().default(2.0),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const sendReminderSchema = z.object({
  reviewerId: z.string().optional(),
  allPending: z.boolean().optional().default(false),
  message: z.string().max(2000).optional(),
});
