import { NextResponse } from "next/server";
import { buildOpenApiDocument, isApiDocsEnabled } from "@/lib/openapi";
import { notFound } from "@/lib/api/response";

export async function GET() {
  if (!isApiDocsEnabled()) {
    return notFound("API docs are disabled");
  }

  return NextResponse.json(buildOpenApiDocument());
}
