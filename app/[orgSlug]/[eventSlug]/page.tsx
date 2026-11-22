import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ClipboardList, FilePlus2 } from "lucide-react";
import { CategoriesList, ContactBlock, EventSection, Guidelines } from "@/components/event-page/event-sections";
import { EventHero } from "@/components/event-page/event-hero";
import { KeyDates, countdownTarget } from "@/components/event-page/key-dates";
import { DeadlineCountdown } from "@/components/shared/deadline-countdown";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { apiFetchServer } from "@/lib/api/server";
import { formatDateRange, formatLongDate, formatLongDateTime } from "@/lib/dates";
import { sanitizeRichHtml } from "@/lib/html";
import { createSignedAssetUrl } from "@/lib/services/events/storage";
import type { PublicEventDto } from "@/lib/types/api";

export const instant = false;

/** Public event page (EVT-02). Branding, nav and footer come from the event shell layout. */
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

  const base = `/${orgSlug}/${eventSlug}`;
  const { keyDates } = event;
  const categories = event.categories ?? [];
  const countdown = countdownTarget(keyDates, portalState);
  const opensLater =
    !!keyDates.submissionOpenAt &&
    new Date(keyDates.submissionOpenAt).getTime() > new Date(portalState.now).getTime();

  const submitButton = portalState.canSubmit ? (
    <Button asChild size="lg">
      <Link href={`${base}/submit`}>
        <FilePlus2 data-icon="inline-start" />
        Submit abstract
      </Link>
    </Button>
  ) : (
    <Button size="lg" disabled>
      Submissions closed
    </Button>
  );

  return (
    <div>
      <EventHero
        orgName={organisation.name}
        name={event.name}
        edition={event.edition}
        venue={event.venue}
        dateRange={formatDateRange(event.startsAt, event.endsAt)}
        bannerUrl={bannerUrl}
        logoUrl={logoUrl}
        status={
          portalState.canSubmit ? (
            <StatusBadge status="open" />
          ) : (
            <StatusBadge
              status="closed"
              label={
                opensLater
                  ? `Submissions open ${formatLongDate(keyDates.submissionOpenAt)}`
                  : "Submissions closed"
              }
            />
          )
        }
        actions={
          <>
            {submitButton}
            <Button asChild variant="outline" size="lg">
              <Link href={`${base}/my-submissions`}>My submissions</Link>
            </Button>
          </>
        }
        footnote={
          <div className="flex flex-col gap-3">
            {!portalState.canSubmit ? (
              <p className="text-base text-muted-foreground">Submissions are not open at this time.</p>
            ) : null}
            {countdown ? (
              <DeadlineCountdown label={countdown.label} deadline={countdown.deadline} className="max-w-md" />
            ) : null}
          </div>
        }
      />

      <div className="mx-auto grid max-w-6xl gap-10 px-gutter py-10 md:px-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14 lg:py-14">
        <div className="min-w-0 space-y-12">
          <EventSection id="call-for-abstracts" title="Call for abstracts">
            <div className="space-y-5">
              <p className="max-w-[68ch] text-lg">
                {keyDates.submissionCloseAt ? (
                  <>
                    Send your abstract by{" "}
                    <strong className="font-semibold">{formatLongDateTime(keyDates.submissionCloseAt)}</strong>{" "}
                    (Sri Lanka time).
                  </>
                ) : (
                  <>The submission deadline will be announced soon.</>
                )}{" "}
                {categories.length > 0
                  ? `Choose the track that best fits your work from the ${categories.length} below.`
                  : null}
              </p>
              <Guidelines html={guidelinesHtml} pdfUrl={pdfUrl} />
            </div>
          </EventSection>

          <EventSection id="tracks" title="Tracks">
            <CategoriesList categories={categories} />
          </EventSection>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-primary-tint/60 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold">
                {portalState.canSubmit ? "Ready to submit?" : "Already submitted?"}
              </p>
              <p className="text-base text-muted-foreground">
                {portalState.canSubmit
                  ? "You can save a draft and come back before the deadline."
                  : "Track your abstracts and decisions from My submissions."}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {portalState.canSubmit ? submitButton : (
                <Button asChild variant="outline">
                  <Link href={`${base}/my-submissions`}>My submissions</Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        <aside className="min-w-0 space-y-8 lg:sticky lg:top-24 lg:self-start">
          <EventSection id="key-dates" title="Key dates">
            <KeyDates keyDates={keyDates} now={portalState.now} />
            <p className="mt-4 text-sm text-muted-foreground">All times are Sri Lanka time (Asia/Colombo).</p>
          </EventSection>

          <ContactBlock
            orgName={organisation.name}
            email={event.contactEmail}
            phone={event.contactPhone}
          />

          <Link
            href={`${base}/reviews`}
            className="-mx-2 flex min-h-control items-center gap-3 rounded-md px-2 text-base text-brand-ink hover:bg-muted"
          >
            <ClipboardList className="size-5 shrink-0" aria-hidden />
            <span className="flex-1">Reviewer? Open your review list</span>
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </aside>
      </div>
    </div>
  );
}
