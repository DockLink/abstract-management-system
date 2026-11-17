import { createOrgSchema, inviteOrgMemberSchema } from "@/lib/validators/orgs";
import { bearerAuth, errorResponses, jsonBody, jsonResponse } from "@/lib/openapi/helpers";
import { registry } from "@/lib/openapi/registry";
import {
  dataEnvelope,
  orgIdParam,
  orgMembershipParams,
  orgSchema,
} from "@/lib/openapi/schemas";
import { z } from "@/lib/openapi/zod";

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs",
  tags: ["Orgs"],
  summary: "List organisations for the current user",
  security: bearerAuth,
  responses: {
    200: jsonResponse(dataEnvelope(z.array(orgSchema)), "Organisations"),
    401: errorResponses[401],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orgs",
  tags: ["Orgs"],
  summary: "Create organisation (platform admin)",
  security: bearerAuth,
  request: jsonBody(createOrgSchema),
  responses: {
    201: jsonResponse(dataEnvelope(orgSchema), "Organisation created"),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    409: errorResponses[409],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}",
  tags: ["Orgs"],
  summary: "Get organisation by id",
  security: bearerAuth,
  request: { params: orgIdParam },
  responses: {
    200: jsonResponse(dataEnvelope(orgSchema), "Organisation"),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orgs/{orgId}/members",
  tags: ["Members"],
  summary: "List organisation members",
  security: bearerAuth,
  request: { params: orgIdParam },
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
  path: "/api/v1/orgs/{orgId}/members/invite",
  tags: ["Members"],
  summary: "Invite organisation admin",
  security: bearerAuth,
  request: {
    params: orgIdParam,
    ...jsonBody(inviteOrgMemberSchema),
  },
  responses: {
    201: jsonResponse(dataEnvelope(z.unknown()), "Invitation created"),
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
  path: "/api/v1/orgs/{orgId}/members/{membershipId}",
  tags: ["Members"],
  summary: "Remove organisation member",
  security: bearerAuth,
  request: { params: orgMembershipParams },
  responses: {
    200: jsonResponse(
      dataEnvelope(z.object({ id: z.string(), deleted: z.boolean() }).passthrough()),
      "Member removed",
    ),
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    500: errorResponses[500],
  },
});
