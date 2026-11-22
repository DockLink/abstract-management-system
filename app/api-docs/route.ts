import { NextResponse } from "next/server";
import { isApiDocsEnabled } from "@/lib/openapi/enabled";
import { notFound } from "@/lib/api/response";

/**
 * Serves Swagger UI as static HTML.
 * Prefer this over swagger-ui-react under Next/Turbopack (OpenAPI refract crashes).
 */
export async function GET() {
  if (!isApiDocsEnabled()) {
    return notFound("API docs are disabled");
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>API Docs · Abstract Management System</title>
  <link rel="stylesheet" href="/swagger-ui/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; }
    .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/swagger-ui/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "/api/v1/openapi",
      dom_id: "#swagger-ui",
      deepLinking: true,
      docExpansion: "list",
      defaultModelsExpandDepth: 1,
      persistAuthorization: true,
      tryItOutEnabled: true,
    });
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
