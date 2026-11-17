import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { KeyDateTimeline } from "@/components/shared/key-date-timeline";
import { DashboardCharts } from "@/components/setup/dashboard-charts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiFetchServer } from "@/lib/api/server";
import { formatLkr } from "@/lib/dates";
import { resolveOrgEventBySlug } from "@/lib/events/resolve";
import type { DashboardDto } from "@/lib/types/api";

export const instant = false;

function StatCard({
  title,
  description,
  value,
  footer,
}: {
  title: string;
  description?: string;
  value: string;
  footer?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl font-semibold tabular-nums">
          {value}
        </CardTitle>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </CardHeader>
      {footer ? <CardContent className="pt-0">{footer}</CardContent> : null}
    </Card>
  );
}

export default async function EventDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string; eventSlug: string }>;
}) {
  const { orgSlug, eventSlug } = await params;
  const { orgId, eventId } = await resolveOrgEventBySlug(orgSlug, eventSlug);

  const result = await apiFetchServer<DashboardDto>(
    `/api/v1/orgs/${orgId}/events/${eventId}/dashboard`,
  );

  if (!result.ok) {
    return (
      <p className="text-sm text-destructive">
        Could not load dashboard: {result.error.message}
      </p>
    );
  }

  const dashboard = result.data;

  const totalSubmissions = Object.values(
    dashboard.submissionsByStatus ?? {},
  ).reduce((sum, n) => sum + n, 0);

  const reviewsDone = dashboard.reviews?.done ?? 0;
  const reviewsPending = dashboard.reviews?.pending ?? 0;
  const reviewsTotal =
    dashboard.reviews?.total ?? reviewsDone + reviewsPending;
  const reviewPct =
    reviewsTotal > 0 ? Math.round((reviewsDone / reviewsTotal) * 100) : 0;

  const keyDates =
    dashboard.event?.keyDates ?? {
      submissionOpenAt: null,
      submissionCloseAt: null,
      reviewDeadlineAt: null,
      notificationAt: null,
      earlyBirdEndAt: null,
      registrationCloseAt: null,
    };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of submissions, reviews, and registrations for this event."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total submissions"
          value={String(totalSubmissions)}
          description="Across all statuses"
        />
        <StatCard
          title="Reviews"
          value={`${reviewsDone} done`}
          description={`${reviewsPending} pending`}
          footer={
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{reviewPct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${reviewPct}%` }}
                />
              </div>
            </div>
          }
        />
        <StatCard
          title="Registrations"
          value={String(dashboard.registrations?.count ?? 0)}
          description="Confirmed attendees"
        />
        <StatCard
          title="Revenue"
          value={formatLkr(dashboard.registrations?.revenue ?? 0)}
          description={dashboard.registrations?.currency ?? "LKR"}
        />
      </div>

      <DashboardCharts
        submissionsByStatus={dashboard.submissionsByStatus ?? {}}
        submissionsByCategory={dashboard.submissionsByCategory ?? []}
      />

      <Card>
        <CardHeader>
          <CardTitle>Key dates</CardTitle>
          <CardDescription>Configured milestones for this event</CardDescription>
        </CardHeader>
        <CardContent>
          <KeyDateTimeline keyDates={keyDates} />
        </CardContent>
      </Card>
    </div>
  );
}
