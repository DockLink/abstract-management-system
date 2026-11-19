import { z } from "@/lib/openapi/zod";
import { registry } from "@/lib/openapi/registry";
import { bearerAuth, jsonBody, jsonResponse } from "@/lib/openapi/helpers";
import {
  orgEventParams,
  orgEventReviewerParams,
  orgEventRubricCriterionParams,
  orgEventReviewAssignmentParams,
  rubricCriterionOpenApiSchema,
  reviewAssignmentOpenApiSchema,
} from "@/lib/openapi/schemas";
import {
  inviteReviewerSchema,
  updateReviewerSchema,
  reviewerAcceptSchema,
  createRubricCriterionSchema,
  updateRubricCriterionSchema,
  reorderRubricCriteriaSchema,
  createAssignmentSchema,
  autoAssignSchema,
  bulkCategoryAssignSchema,
  reassignAssignmentSchema,
  declareConflictSchema,
  saveReviewSchema,
  sendReminderSchema,
} from "@/lib/validators/reviews";

// ─── Reviewers Pool ──────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviewers",
  tags: ["Reviews"],
  summary: "List all reviewers in event pool with expertise and progress",
  security: bearerAuth,
  request: { params: orgEventParams },
  responses: {
    200: jsonResponse(z.array(z.record(z.string(), z.unknown())), "Reviewers list"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviewers/invite",
  tags: ["Reviews"],
  summary: "Invite a reviewer with expertise categories and max load (REV-01)",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    ...jsonBody(inviteReviewerSchema, "Reviewer invitation details"),
  },
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "Reviewer already registered"),
    201: jsonResponse(z.record(z.string(), z.unknown()), "Reviewer invited"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviewers/{reviewerId}",
  tags: ["Reviews"],
  summary: "Get reviewer profile and assignment history",
  security: bearerAuth,
  request: { params: orgEventReviewerParams },
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "Reviewer details"),
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviewers/{reviewerId}",
  tags: ["Reviews"],
  summary: "Update reviewer expertise categories and max load",
  security: bearerAuth,
  request: {
    params: orgEventReviewerParams,
    ...jsonBody(updateReviewerSchema, "Update fields"),
  },
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "Reviewer updated"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviewers/{reviewerId}",
  tags: ["Reviews"],
  summary: "Remove reviewer role from event",
  security: bearerAuth,
  request: { params: orgEventReviewerParams },
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "Reviewer removed"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviewers/me",
  tags: ["Reviews"],
  summary: "Get current user's reviewer status and confidentiality agreement status",
  security: bearerAuth,
  request: { params: orgEventParams },
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "Current reviewer status"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviewers/me/accept",
  tags: ["Reviews"],
  summary: "Accept invitation and agree to confidentiality (REV-02)",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    ...jsonBody(reviewerAcceptSchema, "Confidentiality agreement"),
  },
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "Invitation and agreement accepted"),
  },
});

// ─── Rubric Criteria Builder ─────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/rubric-criteria",
  tags: ["Rubric"],
  summary: "List rubric criteria for event (REV-04)",
  security: bearerAuth,
  request: { params: orgEventParams },
  responses: {
    200: jsonResponse(z.array(rubricCriterionOpenApiSchema), "Rubric criteria list"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/rubric-criteria",
  tags: ["Rubric"],
  summary: "Create rubric criterion (REV-04)",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    ...jsonBody(createRubricCriterionSchema, "Criterion details"),
  },
  responses: {
    201: jsonResponse(rubricCriterionOpenApiSchema, "Criterion created"),
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/rubric-criteria/{criterionId}",
  tags: ["Rubric"],
  summary: "Update rubric criterion",
  security: bearerAuth,
  request: {
    params: orgEventRubricCriterionParams,
    ...jsonBody(updateRubricCriterionSchema, "Criterion update fields"),
  },
  responses: {
    200: jsonResponse(rubricCriterionOpenApiSchema, "Criterion updated"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/rubric-criteria/{criterionId}",
  tags: ["Rubric"],
  summary: "Delete rubric criterion",
  security: bearerAuth,
  request: { params: orgEventRubricCriterionParams },
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "Criterion deleted"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/rubric-criteria/reorder",
  tags: ["Rubric"],
  summary: "Reorder rubric criteria",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    ...jsonBody(reorderRubricCriteriaSchema, "Reorder list"),
  },
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "Reordered successfully"),
  },
});

// ─── Assignments & Auto-Assign ───────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviews/assignments",
  tags: ["Review Assignments"],
  summary: "List review assignments with filters",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    query: z.object({
      submissionId: z.string().optional(),
      reviewerId: z.string().optional(),
      status: z.string().optional(),
      categoryId: z.string().optional(),
      page: z.coerce.number().optional(),
      limit: z.coerce.number().optional(),
    }),
  },
  responses: {
    200: jsonResponse(
      z.object({
        data: z.array(reviewAssignmentOpenApiSchema),
        meta: z.object({
          total: z.number(),
          page: z.number(),
          limit: z.number(),
          totalPages: z.number(),
        }),
      }),
      "Assignments list",
    ),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviews/assignments",
  tags: ["Review Assignments"],
  summary: "Manual create assignment single or batch (REV-06)",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    ...jsonBody(z.union([createAssignmentSchema, z.record(z.string(), z.unknown())]), "Assignment payload"),
  },
  responses: {
    201: jsonResponse(z.record(z.string(), z.unknown()), "Assignment created"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviews/assignments/{assignmentId}",
  tags: ["Review Assignments"],
  summary: "Review screen data: blind-safe abstract, rubric, review form, next/prev navigation (REV-08)",
  security: bearerAuth,
  request: { params: orgEventReviewAssignmentParams },
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "Review screen details"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviews/assignments/{assignmentId}",
  tags: ["Review Assignments"],
  summary: "Delete assignment / unassign reviewer",
  security: bearerAuth,
  request: { params: orgEventReviewAssignmentParams },
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "Assignment deleted"),
  },
});

registry.registerPath({
  method: "put",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviews/assignments/{assignmentId}/save",
  tags: ["Review Assignments"],
  summary: "Auto-save draft or submit final review score (REV-04, REV-05, REV-08)",
  security: bearerAuth,
  request: {
    params: orgEventReviewAssignmentParams,
    ...jsonBody(saveReviewSchema, "Review score and recommendation"),
  },
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "Review saved"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviews/assignments/{assignmentId}/conflict",
  tags: ["Review Assignments"],
  summary: "Declare Conflict of Interest (REV-07)",
  security: bearerAuth,
  request: {
    params: orgEventReviewAssignmentParams,
    ...jsonBody(declareConflictSchema, "COI Reason"),
  },
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "Conflict recorded"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviews/assignments/{assignmentId}/reassign",
  tags: ["Review Assignments"],
  summary: "Reassign assignment to new reviewer (REV-13)",
  security: bearerAuth,
  request: {
    params: orgEventReviewAssignmentParams,
    ...jsonBody(reassignAssignmentSchema, "New reviewer details"),
  },
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "Reassigned successfully"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviews/assignments/auto-assign",
  tags: ["Review Assignments"],
  summary: "Run auto-assignment balancing load and skipping same-institution reviewers (REV-06)",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    ...jsonBody(autoAssignSchema, "Auto-assign options"),
  },
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "Auto-assign completed"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviews/assignments/bulk-category",
  tags: ["Review Assignments"],
  summary: "Bulk assign reviewers to all abstracts in a category (REV-06)",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    ...jsonBody(bulkCategoryAssignSchema, "Category and reviewers list"),
  },
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "Bulk assignment completed"),
  },
});

// ─── Reviewer Dashboard, Progress & Scores ───────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviews/my-dashboard",
  tags: ["Reviews"],
  summary: "Reviewer dashboard: assigned, in-progress, completed, countdown (REV-09)",
  security: bearerAuth,
  request: { params: orgEventParams },
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "Reviewer dashboard data"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviews/progress",
  tags: ["Reviews"],
  summary: "Admin/chair progress view: % complete per reviewer and category (REV-10)",
  security: bearerAuth,
  request: { params: orgEventParams },
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "Review progress metrics"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviews/remind",
  tags: ["Reviews"],
  summary: "One-click email reminder to reviewers with pending reviews (REV-10)",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    ...jsonBody(sendReminderSchema, "Reminder options"),
  },
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "Reminders sent"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviews/scores-table",
  tags: ["Reviews"],
  summary: "Score table per abstract with weighted totals, averages, std dev, and dispute flags (REV-11, REV-12)",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    query: z.object({
      categoryId: z.string().optional(),
      disagreementThreshold: z.coerce.number().optional(),
      search: z.string().optional(),
      page: z.coerce.number().optional(),
      limit: z.coerce.number().optional(),
    }),
  },
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "Scores table data"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/reviews/certificate/{reviewerId}",
  tags: ["Reviews"],
  summary: "Reviewer certificate of appreciation export in JSON or HTML (REV-14)",
  security: bearerAuth,
  request: {
    params: orgEventReviewerParams,
    query: z.object({ format: z.enum(["json", "html"]).optional() }),
  },
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "Reviewer certificate data"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/me/reviews",
  tags: ["Reviews"],
  summary: "Current user's global review summary across all events",
  security: bearerAuth,
  responses: {
    200: jsonResponse(z.record(z.string(), z.unknown()), "User's review events summary"),
  },
});
