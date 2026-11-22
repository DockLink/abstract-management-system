import {
  assetKindSchema,
  categorySchema,
  cloneEventSchema,
  createEventSchema,
  deadlineExtensionSchema,
  eligibilitySchema,
  keyDatesSchema,
  presentationTypesSchema,
  submissionTypeSchema,
  updateCategorySchema,
  updateEventSchema,
  updateSubmissionTypeSchema,
} from "@/lib/validators/events";
import {
  inviteEventRoleSchema,
  joinEventRoleSchema,
  updateEventRoleSchema,
} from "@/lib/validators/orgs";
import { bearerAuth, errorResponses, jsonBody, jsonResponse } from "@/lib/openapi/helpers";
import { registry } from "@/lib/openapi/registry";
import {
  appUserSchema,
  dataEnvelope,
  eventRoleSchema,
  eventSchema,
  orgEventCategoryParams,
  orgEventMemberParams,
  orgEventParams,
  orgEventRoleParams,
  orgEventSubmissionTypeParams,
  orgIdParam,
} from "@/lib/openapi/schemas";
import { z } from "@/lib/openapi/zod";

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events",
  tags: ["Events"],
  summary: "List events for an organisation",
  security: bearerAuth,
  request: { params: orgIdParam },
  responses: {
    200: jsonResponse(dataEnvelope(z.array(eventSchema)), "Events"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events",
  tags: ["Events"],
  summary: "Create event",
  security: bearerAuth,
  request: {
    params: orgIdParam,
    ...jsonBody(createEventSchema),
  },
  responses: {
    201: jsonResponse(dataEnvelope(eventSchema), "Event created"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}",
  tags: ["Events"],
  summary: "Get event",
  security: bearerAuth,
  request: { params: orgEventParams },
  responses: {
    200: jsonResponse(dataEnvelope(eventSchema), "Event"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/orgs/{orgId}/events/{eventId}",
  tags: ["Events"],
  summary: "Update event",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    ...jsonBody(updateEventSchema),
  },
  responses: {
    200: jsonResponse(dataEnvelope(eventSchema), "Event updated"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/orgs/{orgId}/events/{eventId}",
  tags: ["Events"],
  summary: "Delete event",
  security: bearerAuth,
  request: { params: orgEventParams },
  responses: {
    200: jsonResponse(
      dataEnvelope(z.object({ id: z.string(), deleted: z.boolean() }).passthrough()),
      "Event deleted",
    ),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/dashboard",
  tags: ["Events"],
  summary: "Event dashboard stats",
  security: bearerAuth,
  request: { params: orgEventParams },
  responses: {
    200: jsonResponse(dataEnvelope(z.unknown()), "Dashboard"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/clone",
  tags: ["Events"],
  summary: "Clone event settings",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    ...jsonBody(cloneEventSchema),
  },
  responses: {
    201: jsonResponse(dataEnvelope(eventSchema), "Cloned event"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/key-dates",
  tags: ["Events"],
  summary: "Get key dates",
  security: bearerAuth,
  request: { params: orgEventParams },
  responses: {
    200: jsonResponse(dataEnvelope(z.unknown()), "Key dates"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "put",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/key-dates",
  tags: ["Events"],
  summary: "Replace key dates",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    ...jsonBody(keyDatesSchema),
  },
  responses: {
    200: jsonResponse(dataEnvelope(z.unknown()), "Key dates updated"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/assets",
  tags: ["Events"],
  summary: "Upload event asset (logo, banner, or guidelines PDF)",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            kind: assetKindSchema,
            file: z.any().openapi({ type: "string", format: "binary" }),
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse(dataEnvelope(z.unknown()), "Asset uploaded"),
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
  path: "/api/v1/orgs/{orgId}/events/{eventId}/categories",
  tags: ["Categories"],
  summary: "List categories",
  security: bearerAuth,
  request: { params: orgEventParams },
  responses: {
    200: jsonResponse(dataEnvelope(z.array(z.unknown())), "Categories"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/categories",
  tags: ["Categories"],
  summary: "Create category",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    ...jsonBody(categorySchema),
  },
  responses: {
    201: jsonResponse(dataEnvelope(z.unknown()), "Category created"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/categories/{categoryId}",
  tags: ["Categories"],
  summary: "Update category",
  security: bearerAuth,
  request: {
    params: orgEventCategoryParams,
    ...jsonBody(updateCategorySchema),
  },
  responses: {
    200: jsonResponse(dataEnvelope(z.unknown()), "Category updated"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/categories/{categoryId}",
  tags: ["Categories"],
  summary: "Delete category",
  security: bearerAuth,
  request: { params: orgEventCategoryParams },
  responses: {
    200: jsonResponse(
      dataEnvelope(z.object({ id: z.string(), deleted: z.boolean() }).passthrough()),
      "Category deleted",
    ),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submission-types",
  tags: ["SubmissionTypes"],
  summary: "List submission types",
  security: bearerAuth,
  request: { params: orgEventParams },
  responses: {
    200: jsonResponse(dataEnvelope(z.array(z.unknown())), "Submission types"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submission-types",
  tags: ["SubmissionTypes"],
  summary: "Create submission type",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    ...jsonBody(submissionTypeSchema),
  },
  responses: {
    201: jsonResponse(dataEnvelope(z.unknown()), "Submission type created"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submission-types/{typeId}",
  tags: ["SubmissionTypes"],
  summary: "Update submission type",
  security: bearerAuth,
  request: {
    params: orgEventSubmissionTypeParams,
    ...jsonBody(updateSubmissionTypeSchema),
  },
  responses: {
    200: jsonResponse(dataEnvelope(z.unknown()), "Submission type updated"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/submission-types/{typeId}",
  tags: ["SubmissionTypes"],
  summary: "Delete submission type",
  security: bearerAuth,
  request: { params: orgEventSubmissionTypeParams },
  responses: {
    200: jsonResponse(
      dataEnvelope(z.object({ id: z.string(), deleted: z.boolean() }).passthrough()),
      "Submission type deleted",
    ),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/presentation-types",
  tags: ["PresentationTypes"],
  summary: "List presentation types",
  security: bearerAuth,
  request: { params: orgEventParams },
  responses: {
    200: jsonResponse(dataEnvelope(z.array(z.unknown())), "Presentation types"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "put",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/presentation-types",
  tags: ["PresentationTypes"],
  summary: "Replace presentation types",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    ...jsonBody(presentationTypesSchema),
  },
  responses: {
    200: jsonResponse(dataEnvelope(z.array(z.unknown())), "Presentation types updated"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/eligibility",
  tags: ["Eligibility"],
  summary: "Get eligibility rules",
  security: bearerAuth,
  request: { params: orgEventParams },
  responses: {
    200: jsonResponse(dataEnvelope(z.unknown()), "Eligibility"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "put",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/eligibility",
  tags: ["Eligibility"],
  summary: "Update eligibility rules",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    ...jsonBody(eligibilitySchema),
  },
  responses: {
    200: jsonResponse(dataEnvelope(z.unknown()), "Eligibility updated"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/members",
  tags: ["EventMembers"],
  summary: "List/search college members for eligibility",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    query: z.object({
      q: z.string().optional().openapi({
        description: "Search name, email, membership no, or SLMC no",
      }),
    }),
  },
  responses: {
    200: jsonResponse(dataEnvelope(z.array(z.unknown())), "Members"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/members",
  tags: ["EventMembers"],
  summary: "Import members (CSV multipart or JSON)",
  description:
    "Send multipart/form-data with field `file` (CSV), or JSON `{ members: [...] }`.",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z.any().openapi({ type: "string", format: "binary" }),
          }),
        },
        "application/json": {
          schema: z.object({
            members: z.array(
              z.object({
                name: z.string(),
                membershipNo: z.string().optional().nullable(),
                slmcNo: z.string().optional().nullable(),
                email: z.string().email().optional().nullable(),
              }),
            ),
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse(dataEnvelope(z.unknown()), "Import result"),
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
  path: "/api/v1/orgs/{orgId}/events/{eventId}/members/{memberId}",
  tags: ["EventMembers"],
  summary: "Delete member record",
  security: bearerAuth,
  request: { params: orgEventMemberParams },
  responses: {
    200: jsonResponse(
      dataEnvelope(z.object({ id: z.string(), deleted: z.boolean() }).passthrough()),
      "Member deleted",
    ),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/deadline-extensions",
  tags: ["DeadlineExtensions"],
  summary: "List deadline extensions",
  security: bearerAuth,
  request: { params: orgEventParams },
  responses: {
    200: jsonResponse(dataEnvelope(z.array(z.unknown())), "Extensions"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/deadline-extensions",
  tags: ["DeadlineExtensions"],
  summary: "Grant deadline extension",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    ...jsonBody(deadlineExtensionSchema),
  },
  responses: {
    201: jsonResponse(dataEnvelope(z.unknown()), "Extension created"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/deadline-extensions",
  tags: ["DeadlineExtensions"],
  summary: "Delete deadline extension",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    query: z.object({
      id: z.string().min(1).openapi({ description: "Deadline extension id" }),
    }),
  },
  responses: {
    200: jsonResponse(
      dataEnvelope(z.object({ id: z.string(), deleted: z.boolean() })),
      "Extension deleted",
    ),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/roles",
  tags: ["Roles"],
  summary: "List event roles",
  security: bearerAuth,
  request: { params: orgEventParams },
  responses: {
    200: jsonResponse(dataEnvelope(z.array(eventRoleSchema)), "Roles"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/roles/invite",
  tags: ["Roles"],
  summary: "Invite event role by email",
  description:
    "Invite EVENT_ADMIN, TRACK_CHAIR, REVIEWER, or FINANCE_OFFICER. SUBMITTER and DELEGATE must use /roles/join.",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    ...jsonBody(inviteEventRoleSchema),
  },
  responses: {
    200: jsonResponse(
      dataEnvelope(
        z.object({
          invited: z.boolean(),
          user: appUserSchema,
          role: eventRoleSchema,
        }),
      ),
      "Existing user role upserted",
    ),
    201: jsonResponse(
      dataEnvelope(
        z.object({
          invited: z.boolean(),
          user: appUserSchema,
          role: eventRoleSchema,
        }),
      ),
      "Role invitation created",
    ),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    409: errorResponses[409],
    422: errorResponses[422],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/roles/join",
  tags: ["Roles"],
  summary: "Self-join as submitter or delegate",
  description:
    "Authenticated users assign themselves SUBMITTER or DELEGATE on an event. No admin invite required.",
  security: bearerAuth,
  request: {
    params: orgEventParams,
    ...jsonBody(joinEventRoleSchema),
  },
  responses: {
    200: jsonResponse(
      dataEnvelope(
        z.object({
          created: z.boolean(),
          role: eventRoleSchema,
        }),
      ),
      "Already had role",
    ),
    201: jsonResponse(
      dataEnvelope(
        z.object({
          created: z.boolean(),
          role: eventRoleSchema,
        }),
      ),
      "Role joined",
    ),
    400: errorResponses[400],
    401: errorResponses[401],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/orgs/{orgId}/events/{eventId}/roles/{roleId}",
  tags: ["Roles"],
  summary: "Update track chair category assignments",
  security: bearerAuth,
  request: {
    params: orgEventRoleParams,
    ...jsonBody(updateEventRoleSchema),
  },
  responses: {
    200: jsonResponse(dataEnvelope(eventRoleSchema), "Role updated"),
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
  path: "/api/v1/orgs/{orgId}/events/{eventId}/roles/{roleId}",
  tags: ["Roles"],
  summary: "Remove event role",
  security: bearerAuth,
  request: { params: orgEventRoleParams },
  responses: {
    200: jsonResponse(
      dataEnvelope(z.object({ id: z.string(), deleted: z.boolean() }).passthrough()),
      "Role removed",
    ),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});
