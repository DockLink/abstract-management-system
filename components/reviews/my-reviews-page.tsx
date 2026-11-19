"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api/client";
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ChevronRight,
  ShieldCheck,
  Loader2,
} from "lucide-react";

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

  useEffect(() => {
    apiFetch<{ events: ReviewEventItem[] }>("/api/v1/me/reviews")
      .then((res) => {
        if (res.ok) {
          setEvents(res.data.events);
        } else {
          toast.error(res.error.message || "Failed to load review events");
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error("Error loading reviews");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your reviewer portal...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
            Peer Reviewer
          </Badge>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          My Review Portals
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conferences and academic events where you are registered as a peer reviewer.
        </p>
      </div>

      {events.length === 0 ? (
        <Card className="border-dashed p-12 text-center text-muted-foreground">
          <ClipboardCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">
            No Reviewer Assignments
          </h3>
          <p className="text-xs mt-1 max-w-sm mx-auto">
            You are not currently assigned to review abstracts for any conference. Once invited by an
            academic committee, your review portals will appear here.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map((evt) => {
            const orgSlug = evt.organisation.slug;
            const eventSlug = evt.eventSlug;
            const reviewUrl = `/${orgSlug}/${eventSlug}/reviews`;

            return (
              <Card
                key={evt.roleId}
                className="border shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all bg-white dark:bg-slate-900 flex flex-col justify-between"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                        {evt.organisation.name}
                      </span>
                      <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {evt.eventName}
                      </CardTitle>
                    </div>
                    {evt.hasAgreedToConfidentiality ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">
                        Active Reviewer
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                        Pending Sign-off
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-3">
                  {/* Deadline */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    <span>
                      {evt.daysRemaining !== null ? (
                        evt.isExpired ? (
                          <strong className="text-rose-600">Deadline Expired</strong>
                        ) : (
                          <>
                            <strong>{evt.daysRemaining} days left</strong> until review deadline
                          </>
                        )
                      ) : (
                        "No deadline set"
                      )}
                    </span>
                  </div>

                  {/* Counts pill row */}
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t text-center text-xs">
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {evt.counts.total}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Assigned</div>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                      <div className="font-bold text-amber-600 dark:text-amber-400">
                        {evt.counts.inProgress}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Draft</div>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">
                        {evt.counts.completed}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Done</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                      <div className="font-bold text-slate-700 dark:text-slate-300">
                        {evt.counts.pending}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Pending</div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="p-5 pt-0 border-t flex justify-end">
                  <Link href={reviewUrl} className="w-full">
                    <Button className="w-full bg-primary text-primary-foreground font-semibold">
                      Open Review Portal
                      <ChevronRight className="h-4 w-4 ml-1.5" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

