import Image from "next/image";
import { notFound } from "next/navigation";
import { EventDate } from "@/components/shared/event-date";
import { KeyDateTimeline } from "@/components/shared/key-date-timeline";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiFetchServer } from "@/lib/api/server";
import { sanitizeRichHtml } from "@/lib/html";
import { createSignedAssetUrl } from "@/lib/services/events/storage";
import type { PublicEventDto } from "@/lib/types/api";

export const instant = false;

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
}) {
  const { orgSlug, eventSlug } = await params;

  const result = await apiFetchServer<PublicEventDto>(
    `/api/v1/public/orgs/${orgSlug}/events/${eventSlug}`,
    { token: null },
  );

  if (!result.ok) {
    notFound();
  }

  const { organisation, event, portalState } = result.data;

  const [logoUrl, bannerUrl, pdfUrl] = await Promise.all([
    event.logoPath ? createSignedAssetUrl(event.logoPath) : null,
    event.bannerPath ? createSignedAssetUrl(event.bannerPath) : null,
    event.guidelinesPdfPath
      ? createSignedAssetUrl(event.guidelinesPdfPath)
      : null,
  ]);

  const guidelinesHtml = event.guidelinesRichText?.trim()
    ? sanitizeRichHtml(event.guidelinesRichText)
    : null;

  return (
    <main className="min-h-screen bg-surface">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        {bannerUrl ? (
          <div className="relative mb-6 aspect-[2.4/1] overflow-hidden rounded-xl border border-border bg-muted">
            <Image
              src={bannerUrl}
              alt=""
              fill
              className="object-cover"
              priority
              unoptimized
            />
          </div>
        ) : null}

        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start">
          {logoUrl ? (
            <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-border bg-white">
              <Image
                src={logoUrl}
                alt=""
                fill
                className="object-contain p-2"
                unoptimized
              />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">
              {organisation.name}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
              {event.name}
            </h1>
            {event.edition ? (
              <p className="mt-2 text-lg text-muted-foreground">
                {event.edition}
              </p>
            ) : null}
            {event.venue ? (
              <p className="mt-2 text-sm text-foreground">{event.venue}</p>
            ) : null}
            {event.startsAt || event.endsAt ? (
              <p className="mt-2 text-sm text-muted-foreground">
                <EventDate value={event.startsAt} includeTime={false} />
                {event.startsAt && event.endsAt ? " — " : null}
                <EventDate value={event.endsAt} includeTime={false} />
              </p>
            ) : null}
          </div>
        </header>

        {event.contactEmail || event.contactPhone ? (
          <p className="mb-8 text-sm text-muted-foreground">
            Questions?{" "}
            {event.contactEmail ? (
              <a
                href={`mailto:${event.contactEmail}`}
                className="text-primary hover:underline"
              >
                {event.contactEmail}
              </a>
            ) : null}
            {event.contactEmail && event.contactPhone ? " · " : null}
            {event.contactPhone ? <span>{event.contactPhone}</span> : null}
          </p>
        ) : null}

        {guidelinesHtml ? (
          <section className="mb-10">
            <h2 className="mb-3 text-lg font-semibold">Submission guidelines</h2>
            <div
              className="prose prose-sm max-w-none rounded-xl border border-border bg-white p-6"
              dangerouslySetInnerHTML={{ __html: guidelinesHtml }}
            />
            {pdfUrl ? (
              <p className="mt-4">
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Download guidelines (PDF)
                </a>
              </p>
            ) : null}
          </section>
        ) : pdfUrl ? (
          <section className="mb-10">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary hover:underline"
            >
              Download submission guidelines (PDF)
            </a>
          </section>
        ) : null}

        <Card className="mb-10">
          <CardHeader>
            <CardTitle className="text-base">Important dates</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyDateTimeline keyDates={event.keyDates} />
          </CardContent>
        </Card>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          {portalState.canSubmit ? (
            <Button asChild className="h-11 px-8">
              <a href={`/${orgSlug}/${eventSlug}/submit`}>Submit abstract</a>
            </Button>
          ) : (
            <Button className="h-11 px-8" disabled>
              Submissions closed
            </Button>
          )}
          <Button asChild variant="outline" className="h-11 px-6">
            <a href={`/${orgSlug}/${eventSlug}/my-submissions`}>My submissions</a>
          </Button>
          <Button asChild variant="ghost" className="h-11 px-4 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
            <a href={`/${orgSlug}/${eventSlug}/reviews`}>Reviewer Portal &rarr;</a>
          </Button>
          {!portalState.canSubmit ? (
            <p className="text-sm text-muted-foreground">
              Submissions are not open at this time.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
