import { NextResponse } from "next/server";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function fail(
  code: string,
  message: string,
  status: number,
  details?: unknown,
) {
  const body: ApiErrorBody = {
    error: details === undefined ? { code, message } : { code, message, details },
  };
  return NextResponse.json(body, { status });
}

export function unauthorized(message = "Authentication required") {
  return fail("UNAUTHORIZED", message, 401);
}

export function forbidden(message = "Insufficient permissions") {
  return fail("FORBIDDEN", message, 403);
}

export function notFound(message = "Resource not found") {
  return fail("NOT_FOUND", message, 404);
}

export function conflict(message: string, details?: unknown) {
  return fail("CONFLICT", message, 409, details);
}

export function badRequest(message: string, details?: unknown) {
  return fail("BAD_REQUEST", message, 400, details);
}

export function unprocessable(message: string, details?: unknown) {
  return fail("UNPROCESSABLE", message, 422, details);
}

export function serverError(message = "Internal server error", details?: unknown) {
  return fail("INTERNAL_ERROR", message, 500, details);
}
