"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardCheck } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { CardListSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import { formatLongDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface ReviewEventItem {
  roleId: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  organisation: {
    id: string;
    name: string;
    slug: string;
    logoPath: string | null;
  };
  invitationStatus: "PENDING" | "ACCEPTED" | "DECLINED";
  hasAgreedToConfidentiality: boolean;
  confidentialityAgreedAt: string | null;
  reviewDeadlineAt: string | null;
  daysRemaining: number | null;
  isExpired: boolean;
  counts: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    conflict: number;
  };
}

export function MyReviewsPage() {
  const [events, setEvents] = useState<ReviewEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    apiFetch<{ events: ReviewEventItem[] }>("/api/v1/me/reviews")
      .then((res) => {
        if (!live) return;
        if (res.ok) {
          setEvents(res.data.events);
          setError(null);
        } else {
          setError(res.error.message || "Your review events couldn't be loaded.");
        }
      })
      .catch(() => live && setError("Your review events couldn't be loaded."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [attempt]);

  return (
    <div className="mx-auto max-w-5xl px-gutter py-6 md:py-10">
      <PageHeader title="Your reviews" description="Events where you review abstracts." />
      {loading ? (
        <CardListSkeleton count={2} label="Loading your review events…" />
      ) : error ? (
        <ErrorState
          title="Your review events didn't load"
          description={error}
          onRetry={() => {
            setLoading(true);
            setAttempt((a) => a + 1);
          }}
        />
      ) : events.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="You're not reviewing for any event yet"
          description="When a committee invites you to review, the event appears here."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {events.map((evt) => {
            const href = `/${evt.organisation.slug}/${evt.eventSlug}/reviews`;
            const outstanding = evt.counts.pending + evt.counts.inProgress;
            return (
              <li key={evt.roleId} className="flex flex-col rounded-lg border border-border bg-card p-4 md:p-5">
                <p className="text-sm text-muted-foreground">{evt.organisation.name}</p>
                <h2 className="mt-0.5 font-heading text-xl leading-snug font-semibold">{evt.eventName}</h2>
                <p className="mt-2 text-base">
                  {evt.counts.completed} of {evt.counts.total - evt.counts.conflict} done
                  {outstanding ? <span className="text-muted-foreground"> · {outstanding} to do</span> : null}
                </p>
                <p className={cn("mt-1 text-sm", evt.isExpired ? "text-danger-foreground" : "text-muted-foreground")}>
                  {!evt.hasAgreedToConfidentiality
                    ? "Agree to the confidentiality terms to start."
                    : evt.reviewDeadlineAt
                      ? `${evt.isExpired ? "Closed" : "Due"} ${formatLongDate(evt.reviewDeadlineAt)}${evt.daysRemaining !== null && !evt.isExpired ? ` · ${evt.daysRemaining} days left` : ""}`
                      : "No review deadline set"}
                </p>
                <div className="mt-4 flex flex-1 items-end">
                  <Button asChild className="w-full">
                    <Link href={href}>
                      {!evt.hasAgreedToConfidentiality ? "Review the terms" : outstanding ? "Open reviews" : "View reviews"}
                      <ChevronRight data-icon="inline-end" />
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
