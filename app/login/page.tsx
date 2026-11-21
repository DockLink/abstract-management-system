import { AuthPanel, type AuthMode } from "@/components/auth/auth-panel";
import { BrandGrid } from "@/components/shared/brand-grid";
import { BrandScope } from "@/components/shared/brand-scope";
import { apiFetchServer } from "@/lib/api/server";
import { formatDateRange } from "@/lib/dates";
import type { PublicEventDto } from "@/lib/types/api";

export const instant = false;

const NON_EVENT_SEGMENTS = new Set(["org", "login", "auth", "platform", "my-reviews", "dev", "api", "api-docs", "swagger-ui"]);

/** If `next` points into an event's portal, brand the page for that event. */
async function eventFromNext(next: string | undefined) {
  const match = next?.match(/^\/([a-z0-9-]+)\/([a-z0-9-]+)(?:\/|$)/i);
  if (!match || NON_EVENT_SEGMENTS.has(match[1])) return null;
  const res = await apiFetchServer<PublicEventDto>(
    `/api/v1/public/orgs/${match[1]}/events/${match[2]}`,
    { token: null },
  );
  return res.ok ? res.data : null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const mode: AuthMode = params.mode === "signup" ? "signup" : "signin";
  const ctx = await eventFromNext(params.next);

  const title = ctx?.event.name ?? "Abstract Management System";
  const lead = ctx
    ? "Sign in to submit and track your abstracts, review assigned work, or manage the event."
    : "Submit and track abstracts, review assigned work, and run your college's academic sessions.";
  const dates = ctx ? formatDateRange(ctx.event.startsAt, ctx.event.endsAt) : null;

  return (
    <BrandScope brand={ctx?.event.primaryColor}>
      <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_minmax(30rem,36rem)]">
        {/* Brand panel — a strip on phones, a full column on desktop */}
        <BrandGrid className="flex flex-col justify-end px-gutter py-6 sm:px-8 lg:min-h-screen lg:justify-between lg:px-12 lg:py-12">
          <p className="hidden text-base opacity-90 lg:block">{ctx?.organisation.name ?? "DocLink"}</p>
          <div className="max-w-xl">
            {ctx ? <p className="text-sm opacity-90 lg:hidden">{ctx.organisation.name}</p> : null}
            <p className="font-heading text-2xl leading-tight font-semibold [overflow-wrap:anywhere] lg:text-5xl">
              {title}
            </p>
            {ctx?.event.edition ? <p className="mt-1 text-base opacity-90 lg:mt-3 lg:text-xl">{ctx.event.edition}</p> : null}
            {dates ? <p className="mt-1 text-base opacity-90 lg:mt-2">{dates}</p> : null}
            <p className="mt-6 hidden max-w-md text-lg opacity-90 lg:block">{lead}</p>
          </div>
          <p className="hidden text-sm opacity-80 lg:block">
            Powered by <span className="font-semibold">DocLink</span>
          </p>
        </BrandGrid>

        <div className="flex flex-col justify-center px-gutter py-8 sm:px-10 lg:px-14">
          <div className="mx-auto w-full max-w-md">
            <AuthPanel
              lead={lead}
              initialMode={mode}
              nextPath={params.next ?? "/"}
              orgName={ctx?.organisation.name ?? "DocLink"}
            />
            <p className="mt-10 text-center text-sm text-muted-foreground lg:hidden">
              Powered by <span className="font-semibold">DocLink</span>
            </p>
          </div>
        </div>
      </main>
    </BrandScope>
  );
}
