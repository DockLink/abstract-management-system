import { errorResponses, jsonResponse } from "@/lib/openapi/helpers";
import { registry } from "@/lib/openapi/registry";
import { dataEnvelope, publicEventParams } from "@/lib/openapi/schemas";
import { z } from "@/lib/openapi/zod";

registry.registerPath({
  method: "get",
  path: "/api/v1/public/orgs/{orgSlug}/events/{eventSlug}",
  tags: ["Public"],
  summary: "Public event page payload",
  description:
    "No authentication required. Includes branding, key dates, guidelines, portal state and the event's submission categories (names only).",
  request: { params: publicEventParams },
  responses: {
    200: jsonResponse(dataEnvelope(z.unknown()), "Public event"),
    404: errorResponses[404],
    500: errorResponses[500],
  },
});
