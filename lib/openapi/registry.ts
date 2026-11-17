/**
 * OpenAPI maintenance checklist (when adding/changing an API):
 * 1. Update or add Zod schema in lib/validators/*
 * 2. Register/update the path in lib/openapi/paths/*
 * 3. Confirm it appears under /api-docs and "Try it out" still works
 */
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { apiErrorSchema } from "@/lib/openapi/schemas";

export const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description:
    "Supabase access token from POST /api/v1/auth/login or /auth/signup. Paste the accessToken value (without the Bearer prefix).",
});

registry.register("ApiError", apiErrorSchema);
