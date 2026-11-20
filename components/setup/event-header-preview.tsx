"use client";

import Image from "next/image";
import { EventDate } from "@/components/shared/event-date";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type EventHeaderPreviewProps = {
  name: string;
  edition: string | null;
  venue: string | null;
  startsAt: string | null;
  endsAt: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  className?: string;
};

export function EventHeaderPreview({
  name,
  edition,
  venue,
  startsAt,
  endsAt,
  logoUrl,
  bannerUrl,
  className,
}: EventHeaderPreviewProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {bannerUrl ? (
        <div className="relative aspect-[3/1] w-full bg-muted">
          <Image
            src={bannerUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 40rem, 100vw"
            className="object-cover"
            unoptimized
          />
        </div>
      ) : (
        <div className="aspect-[3/1] w-full bg-primary-tint" />
      )}
      <CardHeader className="border-b border-border">
        <div className="flex gap-3">
          {logoUrl ? (
            <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-white">
              <Image
                src={logoUrl}
                alt=""
                fill
                sizes="56px"
                className="object-contain p-1"
                unoptimized
              />
            </div>
          ) : (
            <div className="size-14 shrink-0 rounded-lg border border-dashed border-border bg-muted" />
          )}
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg leading-tight">{name || "Event name"}</CardTitle>
            {edition ? (
              <CardDescription className="mt-1">{edition}</CardDescription>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-4 text-sm">
        {venue ? (
          <p>
            <span className="text-muted-foreground">Venue: </span>
            {venue}
          </p>
        ) : null}
        {startsAt || endsAt ? (
          <p>
            <span className="text-muted-foreground">When: </span>
            {startsAt ? <EventDate value={startsAt} includeTime={false} /> : "—"}
            {startsAt && endsAt ? " – " : null}
            {endsAt ? <EventDate value={endsAt} includeTime={false} /> : null}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
