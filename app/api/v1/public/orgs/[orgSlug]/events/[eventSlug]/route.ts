import { routeParams } from "@/lib/api/params";
import { notFound, ok, serverError } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { serializePublicEvent } from "@/lib/services/events/serialize";

type Ctx = { params: Promise<{ orgSlug: string; eventSlug: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const { orgSlug, eventSlug } = await routeParams(context);

    const org = await prisma.organisation.findUnique({
      where: { slug: orgSlug },
    });
    if (!org) return notFound("Organisation not found");

    const event = await prisma.event.findFirst({
      where: { orgId: org.id, slug: eventSlug, deletedAt: null },
    });
    if (!event) return notFound("Event not found");

    // Track names are public (shown on the call for abstracts); chairs are not.
    const categories = await prisma.category.findMany({
      where: { orgId: org.id, eventId: event.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    });

    return ok(serializePublicEvent(event, org, categories));
  } catch (error) {
    console.error("GET /public/.../events/:slug", error);
    return serverError();
  }
}
