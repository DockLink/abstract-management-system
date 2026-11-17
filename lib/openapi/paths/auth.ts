import {
  grantPlatformAdminSchema,
  loginSchema,
  refreshSchema,
  signupSchema,
} from "@/lib/validators/auth";
import { bearerAuth, errorResponses, jsonBody, jsonResponse } from "@/lib/openapi/helpers";
import { registry } from "@/lib/openapi/registry";
import {
  appUserSchema,
  dataEnvelope,
  meEventRoleSchema,
  meOrganisationSchema,
  platformAdminSchema,
  platformAdminUserIdParam,
  sessionSchema,
} from "@/lib/openapi/schemas";
import { z } from "@/lib/openapi/zod";

const meResponseSchema = dataEnvelope(
  z.object({
    user: appUserSchema,
    isPlatformAdmin: z.boolean(),
    organisations: z.array(meOrganisationSchema),
    eventRoles: z.array(meEventRoleSchema),
  }),
);

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/signup",
  tags: ["Auth"],
  summary: "Sign up",
  description: "Create an account. May return a session immediately or require email confirmation.",
  request: jsonBody(signupSchema),
  responses: {
    201: jsonResponse(
      dataEnvelope(
        z.union([
          sessionSchema,
          z.object({
            user: z.object({
              id: z.string(),
              email: z.string().optional(),
              fullName: z.string().nullable(),
            }),
            session: z.null(),
            message: z.string(),
          }),
        ]),
      ),
      "Account created",
    ),
    400: errorResponses[400],
    409: errorResponses[409],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/login",
  tags: ["Auth"],
  summary: "Log in",
  request: jsonBody(loginSchema),
  responses: {
    200: jsonResponse(dataEnvelope(sessionSchema), "Authenticated session"),
    401: errorResponses[401],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/refresh",
  tags: ["Auth"],
  summary: "Refresh session",
  request: jsonBody(refreshSchema),
  responses: {
    200: jsonResponse(dataEnvelope(sessionSchema), "Refreshed session"),
    400: errorResponses[400],
    401: errorResponses[401],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/logout",
  tags: ["Auth"],
  summary: "Log out",
  security: bearerAuth,
  responses: {
    200: jsonResponse(
      dataEnvelope(z.object({ loggedOut: z.boolean() }).passthrough()),
      "Logged out",
    ),
    401: errorResponses[401],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/auth/me",
  tags: ["Auth"],
  summary: "Current user profile and memberships",
  security: bearerAuth,
  responses: {
    200: jsonResponse(meResponseSchema, "Current user"),
    401: errorResponses[401],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/auth/platform-admins",
  tags: ["Auth"],
  summary: "List platform admins",
  description: "Requires platform admin. Lists users with platform_admin app_metadata.",
  security: bearerAuth,
  responses: {
    200: jsonResponse(dataEnvelope(z.array(platformAdminSchema)), "Platform admins"),
    401: errorResponses[401],
    403: errorResponses[403],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/platform-admins",
  tags: ["Auth"],
  summary: "Grant platform admin",
  description:
    "Invite or reuse a user by email and set Supabase app_metadata.role to platform_admin.",
  security: bearerAuth,
  request: jsonBody(grantPlatformAdminSchema),
  responses: {
    200: jsonResponse(
      dataEnvelope(
        z.object({
          invited: z.boolean(),
          user: appUserSchema,
          isPlatformAdmin: z.boolean(),
        }),
      ),
      "Platform admin granted (existing user)",
    ),
    201: jsonResponse(
      dataEnvelope(
        z.object({
          invited: z.boolean(),
          user: appUserSchema,
          isPlatformAdmin: z.boolean(),
        }),
      ),
      "Platform admin granted (invited)",
    ),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    500: errorResponses[500],
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/auth/platform-admins/{userId}",
  tags: ["Auth"],
  summary: "Revoke platform admin",
  description: "Clears platform admin metadata. Cannot revoke yourself.",
  security: bearerAuth,
  request: { params: platformAdminUserIdParam },
  responses: {
    200: jsonResponse(
      dataEnvelope(
        z.object({
          user: appUserSchema,
          isPlatformAdmin: z.boolean(),
          revoked: z.boolean(),
        }),
      ),
      "Platform admin revoked",
    ),
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    422: errorResponses[422],
    500: errorResponses[500],
  },
});
