import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { SetupChecklist, buildSetupSteps } from "@/components/setup/setup-checklist";
import { SetupTabs, type SetupTab } from "@/components/setup/setup-tabs";
import { apiFetchServer } from "@/lib/api/server";
import { resolveOrgEventBySlug } from "@/lib/events/resolve";
import { createSignedAssetUrl } from "@/lib/services/events/storage";
import type { DashboardDto, EventDto } from "@/lib/types/api";

export const instant = false;

async function signedUrl(path: string | null) {
  if (!path) return null;
  return createSignedAssetUrl(path);
}

const TABS: SetupTab[] = ["basics", "public", "dates"];

export default async function EventSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ orgSlug, eventSlug }, { tab }] = await Promise.all([params, searchParams]);
  const { orgId, eventId } = await resolveOrgEventBySlug(orgSlug, eventSlug);

  const [result, dashboard] = await Promise.all([
    apiFetchServer<EventDto>(`/api/v1/orgs/${orgId}/events/${eventId}`),
    apiFetchServer<DashboardDto>(`/api/v1/orgs/${orgId}/events/${eventId}/dashboard`),
  ]);

  if (!result.ok) {
    return (
      <ErrorState
        title="This event didn't load"
        description={result.error.message}
      />
    );
  }

  const event = result.data;
  const [logoUrl, bannerUrl, guidelinesPdfUrl] = await Promise.all([
    signedUrl(event.logoPath),
    signedUrl(event.bannerPath),
    signedUrl(event.guidelinesPdfPath),
  ]);
  const base = `/org/${orgSlug}/events/${eventSlug}`;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Event setup"
        description="Work down the checklist — most events are ready in under an hour."
      />
      {dashboard.ok ? (
        <SetupChecklist steps={buildSetupSteps(dashboard.data.configCompleteness, base)} />
      ) : null}
      <SetupTabs
        initialTab={TABS.includes(tab as SetupTab) ? (tab as SetupTab) : "basics"}
        orgId={orgId}
        eventId={eventId}
        orgSlug={orgSlug}
        eventSlug={eventSlug}
        event={event}
        logoUrl={logoUrl}
        bannerUrl={bannerUrl}
        guidelinesPdfUrl={guidelinesPdfUrl}
      />
    </div>
  );
}
