import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { isApiDocsEnabled } from "@/lib/openapi/enabled";
import { notFound } from "@/lib/api/response";

type Ctx = { params: Promise<{ path: string[] }> };

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
};

export async function GET(_request: Request, context: Ctx) {
  if (!isApiDocsEnabled()) {
    return notFound("API docs are disabled");
  }

  const segments = (await context.params).path;
  if (!segments?.length || segments.some((s) => s.includes(".."))) {
    return notFound();
  }

  const fileName = segments.join("/");
  const filePath = path.join(
    process.cwd(),
    "node_modules",
    "swagger-ui-dist",
    fileName,
  );

  try {
    const body = await readFile(filePath);
    const ext = path.extname(fileName);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return notFound();
  }
}
