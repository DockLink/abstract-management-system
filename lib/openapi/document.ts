import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import "@/lib/openapi/zod";
import { registry } from "@/lib/openapi/registry";

import "@/lib/openapi/paths/auth";
import "@/lib/openapi/paths/orgs";
import "@/lib/openapi/paths/events";
import "@/lib/openapi/paths/public";

export function buildOpenApiDocument() {
  // OpenAPI 3.0 is more reliable with swagger-ui-react under Turbopack than 3.1.
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Abstract Management System API",
      version: "1.0.0",
      description:
        "REST API for multi-tenant abstract management (auth, roles, orgs, events). Authenticate with Bearer JWT from /api/v1/auth/login. Roles attach per organisation/event — not on the user account.",
    },
    servers: [{ url: "/", description: "Current host" }],
    tags: [
      { name: "Auth" },
      { name: "Orgs" },
      { name: "Members" },
      { name: "Events" },
      { name: "Categories" },
      { name: "SubmissionTypes" },
      { name: "PresentationTypes" },
      { name: "Eligibility" },
      { name: "EventMembers" },
      { name: "DeadlineExtensions" },
      { name: "Roles" },
      { name: "Public" },
    ],
  });
}
