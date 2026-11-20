"use client";

import { Suspense, use, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { BarChart3, ExternalLink, Inbox } from "lucide-react";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { KeyDates } from "@/components/event-page/key-dates";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCardsSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { SetupChecklist, buildSetupSteps } from "@/components/setup/setup-checklist";
import { Button } from "@/components/ui/button";
import { apiFetch, type ApiResult } from "@/lib/api/client";
import { formatLkr } from "@/lib/dates";
import { useNow } from "@/lib/hooks/use-now";
import { STATUS_MAP, normalizeStatus } from "@/lib/status";
import type { DashboardDto } from "@/lib/types/api";

/* ─── Data: one cached request per mount, read with use() under Suspense ── */

const cache = new Map<string, Promise<ApiResult<DashboardDto>>>();

function dashboardRequest(key: string, url: string) {
  let p = cache.get(key);
  if (!p) {
    p = apiFetch<DashboardDto>(url);
    cache.set(key, p);
  }
  return p;
}

/** Pipeline order for the status chart. */
const STATUS_ORDER = [
  "draft",
  "submitted",
  "under_review",
  "revisions_requested",
  "accepted",
  "waitlisted",
  "confirmed",
  "rejected",
  "withdrawn",
];

/* ─── Charts ─────────────────────────────────────────────────────────────── */

type Datum = { label: string; count: number };

/** Horizontal bars, one series, labelled rows: magnitude is the job. */
function BarList({
  data,
  rowLabel,
  caption,
}: {
  data: Datum[];
  rowLabel?: (d: Datum) => React.ReactNode;
  caption: string;
}) {
  return (
    <figure>
      <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
        {/* Row labels in HTML so they can be StatusBadges and wrap cleanly */}
        <ul aria-hidden className="flex flex-col">
          {data.map((d) => (
            <li key={d.label} className="flex h-11 items-center text-sm leading-tight">
              {rowLabel ? rowLabel(d) : <span className="line-clamp-2">{d.label}</span>}
            </li>
          ))}
        </ul>
        <div style={{ height: data.length * 44 }} aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={12}>
              <XAxis type="number" hide allowDecimals={false} domain={[0, "dataMax"]} />
              <YAxis type="category" dataKey="label" hide />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                formatter={(v) => [v ?? 0, "Abstracts"]}
                contentStyle={{
                  background: "var(--popover)",
                  color: "var(--popover-foreground)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 14,
                }}
                labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
              />
              <Bar dataKey="count" fill="var(--brand-ink)" radius={[0, 4, 4, 0]} minPointSize={2} isAnimationActive={false}>
                <LabelList dataKey="count" position="right" style={{ fill: "var(--foreground)", fontSize: 14, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Group</th>
            <th scope="col">Abstracts</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.label}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 md:p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* ─── Body ───────────────────────────────────────────────────────────────── */

function DashboardBody({
  request,
  base,
  publicHref,
  onRetry,
}: {
  request: Promise<ApiResult<DashboardDto>>;
  base: string;
  publicHref: string;
  onRetry: () => void;
}) {
  const result = use(request);
  const now = useNow();

  if (!result.ok) {
    return <ErrorState title="The dashboard didn't load" description={result.error.message} onRetry={onRetry} />;
  }

  const d = result.data;
  const statusEntries = Object.entries(d.submissionsByStatus ?? {});
  const total = statusEntries.reduce((n, [, c]) => n + c, 0);
  const statusData: Datum[] = statusEntries
    .map(([s, count]) => {
      const key = normalizeStatus(s);
      return { key, label: key ? STATUS_MAP[key].label : s, count };
    })
    .sort((a, b) => STATUS_ORDER.indexOf(a.key ?? "") - STATUS_ORDER.indexOf(b.key ?? ""))
    .map(({ label, count }) => ({ label, count }));
  const statusKeyByLabel = new Map(
    statusEntries.map(([s]) => {
      const key = normalizeStatus(s);
      return [key ? STATUS_MAP[key].label : s, key ?? s];
    }),
  );
  const categoryData: Datum[] = [...(d.submissionsByCategory ?? [])]
    .sort((a, b) => b.count - a.count)
    .map((c) => ({ label: c.name, count: c.count }));

  const done = d.reviews?.done ?? 0;
  const pending = d.reviews?.pending ?? 0;
  const reviewTotal = d.reviews?.total ?? done + pending;
  const reviewPct = reviewTotal > 0 ? Math.round((done / reviewTotal) * 100) : 0;

  const steps = buildSetupSteps(d.configCompleteness ?? {}, base);
  const setupDone = steps.every((s) => s.done);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Abstracts submitted" value={total} hint="All statuses" href={`${base}/submissions`} linkLabel="View submissions" />
        <StatCard
          label="Reviews done"
          value={reviewTotal ? `${done} of ${reviewTotal}` : "0"}
          hint={reviewTotal ? `${pending} still to do` : "No reviews assigned yet"}
          progress={reviewTotal ? reviewPct : undefined}
          href={`${base}/reviews`}
          linkLabel="Review progress"
        />
        <StatCard label="Registrations" value={d.registrations?.count ?? 0} hint="Confirmed attendees" />
        <StatCard label="Revenue" value={formatLkr(d.registrations?.revenue ?? 0)} hint="From registrations" />
      </div>

      {!setupDone ? <SetupChecklist steps={steps} compact /> : null}

      {total === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No abstracts yet"
          description={
            d.portalState?.canSubmit
              ? "Submissions are open. Share the public page so authors can find the call for abstracts."
              : "Charts appear here once authors start submitting."
          }
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link href={publicHref} target="_blank">
                  <ExternalLink data-icon="inline-start" />
                  Open public page
                </Link>
              </Button>
              {!setupDone ? (
                <Button asChild variant="outline">
                  <Link href={`${base}/setup`}>Finish setup</Link>
                </Button>
              ) : null}
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Submissions by status" description="Where every abstract is in the pipeline.">
            <BarList
              data={statusData}
              caption="Submissions by status"
              rowLabel={(row) => <StatusBadge status={statusKeyByLabel.get(row.label) ?? row.label} size="sm" />}
            />
          </Panel>
          <Panel title="Submissions by track" description="Largest track first.">
            {categoryData.length ? (
              <BarList data={categoryData} caption="Submissions by track" />
            ) : (
              <p className="flex items-center gap-2 text-base text-muted-foreground">
                <BarChart3 className="size-5" aria-hidden />
                No abstracts have a track yet.
              </p>
            )}
          </Panel>
        </div>
      )}

      <Panel title="Key dates" description="Sri Lanka time (Asia/Colombo).">
        {now ? (
          <KeyDates keyDates={d.event.keyDates} now={now.toISOString()} />
        ) : null}
        <Link href={`${base}/setup?tab=dates`} className="-mx-2 mt-3 inline-flex min-h-control items-center rounded-md px-2 text-base font-medium text-brand-ink hover:bg-muted">
          Edit key dates
        </Link>
      </Panel>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <StatCardsSkeleton />
      <TableSkeleton rows={3} columns={3} label="Loading charts…" />
    </div>
  );
}

/** Event dashboard (EVT-11). Loads in the browser so it can show a skeleton and retry. */
export function EventDashboard({
  orgId,
  eventId,
  orgSlug,
  eventSlug,
}: {
  orgId: string;
  eventId: string;
  orgSlug: string;
  eventSlug: string;
}) {
  const [attempt, setAttempt] = useState(0);
  // The request needs the browser session, so it only starts on the client;
  // the server renders the skeleton (otherwise SSR would render a 401).
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const key = `${eventId}:${attempt}`;
  const request = isClient
    ? dashboardRequest(key, `/api/v1/orgs/${orgId}/events/${eventId}/dashboard`)
    : null;
  // Fresh data on every visit: drop this mount's cached request when leaving.
  useEffect(() => () => void cache.delete(key), [key]);

  const base = `/org/${orgSlug}/events/${eventSlug}`;
  return (
    <div>
      <PageHeader title="Dashboard" description="Submissions, reviews and registrations at a glance (EVT-11)." />
      {request ? (
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardBody
          request={request}
          base={base}
          publicHref={`/${orgSlug}/${eventSlug}`}
          onRetry={() => {
            cache.delete(key);
            setAttempt((a) => a + 1);
          }}
        />
      </Suspense>
      ) : (
        <DashboardSkeleton />
      )}
    </div>
  );
}

function noopSubscribe() {
  return () => {};
}
