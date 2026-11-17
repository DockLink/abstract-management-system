import type { ZodType } from "zod";
import type { RouteConfig } from "@asteasolutions/zod-to-openapi";
import { apiErrorSchema } from "@/lib/openapi/schemas";

export const bearerAuth: NonNullable<RouteConfig["security"]> = [
  { bearerAuth: [] },
];

export function jsonBody(schema: ZodType, description?: string) {
  return {
    body: {
      description,
      content: {
        "application/json": { schema },
      },
    },
  };
}

export function jsonResponse(schema: ZodType, description: string) {
  return {
    description,
    content: {
      "application/json": { schema },
    },
  };
}

export const errorResponses = {
  400: jsonResponse(apiErrorSchema, "Bad request"),
  401: jsonResponse(apiErrorSchema, "Unauthorized"),
  403: jsonResponse(apiErrorSchema, "Forbidden"),
  404: jsonResponse(apiErrorSchema, "Not found"),
  409: jsonResponse(apiErrorSchema, "Conflict"),
  422: jsonResponse(apiErrorSchema, "Unprocessable entity"),
  500: jsonResponse(apiErrorSchema, "Internal server error"),
} as const;
