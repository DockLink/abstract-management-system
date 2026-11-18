import { z } from "@/lib/openapi/zod";
import { registry } from "@/lib/openapi/registry";
import { bearerAuth, errorResponses, jsonBody, jsonResponse } from "@/lib/openapi/helpers";
import {
  orgEventParams,
  orgEventSubmissionParams,
  orgEventSubmissionAuthorParams,
  orgEventSubmissionAffiliationParams,
  orgEventSubmissionTypeParams,
  orgEventSubmissionTypeFormFieldParams,
  submissionOpenApiSchema,
  submissionAuthorOpenApiSchema,
  submissionAffiliationOpenApiSchema,
  formFieldOpenApiSchema,
} from "@/lib/openapi/schemas";
import {
  createSubmissionSchema,
  updateSubmissionSchema,
  adminPatchSubmissionSchema,
  authorSchema,
  updateAuthorSchema,
  reorderAuthorsSchema,
  affiliationSchema,
  updateAffiliationSchema,
  formFieldSchema,
  updateFormFieldSchema,
  reorderFormFieldsSchema,
} from "@/lib/validators/submissions";

// ─── Submissions ─────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submissions",
  tags: ["Submissions"],
  summary: "List submissions (filtered for admin/chair or submitter)",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    query: z.object({
      status: z.string().optional(),
      categoryId: z.string().optional(),
      submissionTypeId: z.string().optional(),
      search: z.string().optional(),
      page: z.coerce.number().optional(),
      limit: z.coerce.number().optional(),
    }),
  },
  responses: {
    200: jsonResponse(
      z.object({
        data: z.array(submissionOpenApiSchema),
        meta: z.object({
          total: z.number(),
          page: z.number(),
          limit: z.number(),
          totalPages: z.number(),
        }),
      }),
      "Submissions list",
    ),
    401: errorResponses[401],
    403: errorResponses[403],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submissions",
  tags: ["Submissions"],
  summary: "Create a submission (draft)",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    ...jsonBody(createSubmissionSchema),
  },
  responses: {
    201: jsonResponse(
      z.object({
        submission: submissionOpenApiSchema,
        warnings: z.array(z.string()),
      }),
      "Created draft submission",
    ),
    400: errorResponses[400],
    401: errorResponses[401],
    422: errorResponses[422],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submissions/{submissionId}",
  tags: ["Submissions"],
  summary: "Get a submission by ID",
  security: bearerAuth,
  request: { params: orgEventSubmissionParams },
  responses: {
    200: jsonResponse(submissionOpenApiSchema, "Submission details"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submissions/{submissionId}",
  tags: ["Submissions"],
  summary: "Update submission draft or admin status patch",
  security: bearerAuth,
  request: {
    params: orgEventSubmissionParams,
    ...jsonBody(updateSubmissionSchema.or(adminPatchSubmissionSchema)),
  },
  responses: {
    200: jsonResponse(submissionOpenApiSchema, "Updated submission"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    422: errorResponses[422],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submissions/{submissionId}",
  tags: ["Submissions"],
  summary: "Soft-delete a submission (Admin only)",
  security: bearerAuth,
  request: { params: orgEventSubmissionParams },
  responses: {
    200: jsonResponse(z.object({ deleted: z.boolean() }), "Deleted status"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submissions/{submissionId}/actions",
  tags: ["Submissions"],
  summary: "Submit or withdraw an abstract (SUB-12, SUB-13)",
  security: bearerAuth,
  request: {
    params: orgEventSubmissionParams,
    ...jsonBody(z.object({ action: z.enum(["submit", "withdraw"]) })),
  },
  responses: {
    200: jsonResponse(submissionOpenApiSchema, "Updated submission status"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    422: errorResponses[422],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submissions/{submissionId}/versions",
  tags: ["Submissions"],
  summary: "Get change history versions for a submission (SUB-13)",
  security: bearerAuth,
  request: { params: orgEventSubmissionParams },
  responses: {
    200: jsonResponse(
      z.array(
        z.object({
          id: z.string(),
          version: z.number().int(),
          content: z.unknown(),
          createdById: z.string(),
          createdAt: z.string().datetime(),
        }),
      ),
      "Submission version history",
    ),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submissions/duplicate-check",
  tags: ["Submissions"],
  summary: "Check for duplicate abstract titles in an event (SUB-15)",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    query: z.object({
      title: z.string().optional(),
      excludeId: z.string().optional(),
      threshold: z.coerce.number().optional(),
    }),
  },
  responses: {
    200: jsonResponse(
      z.object({
        matches: z.array(
          z.object({
            submissionId: z.string(),
            refNo: z.string().nullable(),
            title: z.string(),
            status: z.string(),
            similarity: z.number(),
          }),
        ),
        clusters: z
          .array(
            z.object({
              submissionA: z.object({ id: z.string(), refNo: z.string().nullable(), title: z.string(), status: z.string() }),
              submissionB: z.object({ id: z.string(), refNo: z.string().nullable(), title: z.string(), status: z.string() }),
              similarity: z.number(),
            }),
          )
          .optional(),
      }),
      "Duplicate check results",
    ),
    401: errorResponses[401],
    403: errorResponses[403],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submissions/{submissionId}/files",
  tags: ["Submissions"],
  summary: "Get signed download URL for ERC certificate or custom field file (SUB-08)",
  security: bearerAuth,
  request: {
    params: orgEventSubmissionParams,
    query: z.object({
      kind: z.enum(["erc", "custom"]).optional(),
      fieldId: z.string().optional(),
    }),
  },
  responses: {
    200: jsonResponse(
      z.object({
        url: z.string(),
        storagePath: z.string(),
      }),
      "Signed download URL",
    ),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submissions/{submissionId}/files",
  tags: ["Submissions"],
  summary: "Upload ERC certificate PDF or custom field attachment (SUB-08)",
  security: bearerAuth,
  request: {
    params: orgEventSubmissionParams,
  },
  responses: {
    200: jsonResponse(
      z.object({
        success: z.boolean(),
        kind: z.string(),
        fieldId: z.string().nullable().optional(),
        storagePath: z.string(),
        url: z.string().nullable(),
        fileName: z.string(),
        fileSize: z.number(),
      }),
      "File upload result",
    ),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    422: errorResponses[422],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/me/submissions",
  tags: ["Submissions"],
  summary: "Submitter dashboard: list all user submissions across events (SUB-16)",
  security: bearerAuth,
  request: {
    query: z.object({
      status: z.string().optional(),
      eventId: z.string().optional(),
      page: z.coerce.number().optional(),
      limit: z.coerce.number().optional(),
    }),
  },
  responses: {
    200: jsonResponse(
      z.object({
        data: z.array(z.unknown()),
        meta: z.object({
          total: z.number(),
          page: z.number(),
          limit: z.number(),
          totalPages: z.number(),
        }),
      }),
      "User submissions dashboard",
    ),
    401: errorResponses[401],
    500: errorResponses[500],
  },
});

// ─── Form Fields (SUB-01) ────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submission-types/{typeId}/form-fields",
  tags: ["FormFields"],
  summary: "List form fields for a submission type (SUB-01)",
  security: bearerAuth,
  request: { params: orgEventSubmissionTypeParams },
  responses: {
    200: jsonResponse(z.array(formFieldOpenApiSchema), "Form fields list"),
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submission-types/{typeId}/form-fields",
  tags: ["FormFields"],
  summary: "Create form field for a submission type (SUB-01)",
  security: bearerAuth,
  request: {
    params: orgEventSubmissionTypeParams,
    ...jsonBody(formFieldSchema),
  },
  responses: {
    201: jsonResponse(formFieldOpenApiSchema, "Created form field"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submission-types/{typeId}/form-fields/{fieldId}",
  tags: ["FormFields"],
  summary: "Get form field by ID",
  security: bearerAuth,
  request: { params: orgEventSubmissionTypeFormFieldParams },
  responses: {
    200: jsonResponse(formFieldOpenApiSchema, "Form field details"),
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submission-types/{typeId}/form-fields/{fieldId}",
  tags: ["FormFields"],
  summary: "Update a form field",
  security: bearerAuth,
  request: {
    params: orgEventSubmissionTypeFormFieldParams,
    ...jsonBody(updateFormFieldSchema),
  },
  responses: {
    200: jsonResponse(formFieldOpenApiSchema, "Updated form field"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submission-types/{typeId}/form-fields/{fieldId}",
  tags: ["FormFields"],
  summary: "Delete a form field",
  security: bearerAuth,
  request: { params: orgEventSubmissionTypeFormFieldParams },
  responses: {
    200: jsonResponse(z.object({ deleted: z.boolean() }), "Deleted status"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submission-types/{typeId}/form-fields/reorder",
  tags: ["FormFields"],
  summary: "Reorder form fields for a submission type",
  security: bearerAuth,
  request: {
    params: orgEventSubmissionTypeParams,
    ...jsonBody(reorderFormFieldsSchema),
  },
  responses: {
    200: jsonResponse(z.array(z.object({ id: z.string(), sortOrder: z.number() })), "Reordered fields"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

// ─── Authors (SUB-05) ────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submissions/{submissionId}/authors",
  tags: ["Authors"],
  summary: "List authors of a submission (SUB-05)",
  security: bearerAuth,
  request: { params: orgEventSubmissionParams },
  responses: {
    200: jsonResponse(z.array(submissionAuthorOpenApiSchema), "Authors list"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submissions/{submissionId}/authors",
  tags: ["Authors"],
  summary: "Add an author to a submission (SUB-05)",
  security: bearerAuth,
  request: {
    params: orgEventSubmissionParams,
    ...jsonBody(authorSchema),
  },
  responses: {
    201: jsonResponse(submissionAuthorOpenApiSchema, "Created author"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    422: errorResponses[422],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submissions/{submissionId}/authors/{authorId}",
  tags: ["Authors"],
  summary: "Update an author (SUB-05)",
  security: bearerAuth,
  request: {
    params: orgEventSubmissionAuthorParams,
    ...jsonBody(updateAuthorSchema),
  },
  responses: {
    200: jsonResponse(submissionAuthorOpenApiSchema, "Updated author"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    422: errorResponses[422],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submissions/{submissionId}/authors/{authorId}",
  tags: ["Authors"],
  summary: "Remove an author from a submission",
  security: bearerAuth,
  request: { params: orgEventSubmissionAuthorParams },
  responses: {
    200: jsonResponse(z.object({ deleted: z.boolean() }), "Deleted status"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    422: errorResponses[422],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submissions/{submissionId}/authors/reorder",
  tags: ["Authors"],
  summary: "Reorder authors by drag/order list (SUB-05)",
  security: bearerAuth,
  request: {
    params: orgEventSubmissionParams,
    ...jsonBody(reorderAuthorsSchema),
  },
  responses: {
    200: jsonResponse(z.array(z.object({ id: z.string(), sortOrder: z.number() })), "Reordered authors"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    422: errorResponses[422],
    500: errorResponses[500],
  },
});

// ─── Affiliations (SUB-06) ───────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submissions/{submissionId}/affiliations",
  tags: ["Affiliations"],
  summary: "List affiliations for a submission (SUB-06)",
  security: bearerAuth,
  request: { params: orgEventSubmissionParams },
  responses: {
    200: jsonResponse(z.array(submissionAffiliationOpenApiSchema), "Affiliations list"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submissions/{submissionId}/affiliations",
  tags: ["Affiliations"],
  summary: "Add an affiliation to a submission (SUB-06)",
  security: bearerAuth,
  request: {
    params: orgEventSubmissionParams,
    ...jsonBody(affiliationSchema),
  },
  responses: {
    201: jsonResponse(submissionAffiliationOpenApiSchema, "Created affiliation"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    422: errorResponses[422],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submissions/{submissionId}/affiliations/{affiliationId}",
  tags: ["Affiliations"],
  summary: "Update an affiliation (SUB-06)",
  security: bearerAuth,
  request: {
    params: orgEventSubmissionAffiliationParams,
    ...jsonBody(updateAffiliationSchema),
  },
  responses: {
    200: jsonResponse(submissionAffiliationOpenApiSchema, "Updated affiliation"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    422: errorResponses[422],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submissions/{submissionId}/affiliations/{affiliationId}",
  tags: ["Affiliations"],
  summary: "Delete an affiliation",
  security: bearerAuth,
  request: { params: orgEventSubmissionAffiliationParams },
  responses: {
    200: jsonResponse(z.object({ deleted: z.boolean() }), "Deleted status"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    422: errorResponses[422],
    500: errorResponses[500],
  },
});

