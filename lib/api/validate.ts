import { ZodError, type ZodType } from "zod";
import { badRequest } from "./response";

export function formatZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export function parseBody<T>(schema: ZodType<T>, data: unknown) {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false as const,
      response: badRequest("Validation failed", formatZodError(result.error)),
    };
  }
  return { success: true as const, data: result.data };
}
