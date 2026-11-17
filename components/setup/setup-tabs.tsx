"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { BasicsForm } from "@/components/setup/basics-form";
import { KeyDatesForm } from "@/components/setup/key-dates-form";
import { PublicPageForm } from "@/components/setup/public-page-form";
import type { EventDto, KeyDates } from "@/lib/types/api";

export function SetupTabs({
  orgId,
  eventId,
  orgSlug,
  eventSlug,
  event,
  logoUrl,
  bannerUrl,
  guidelinesPdfUrl,
}: {
  orgId: string;
  eventId: string;
  orgSlug: string;
  eventSlug: string;
  event: EventDto;
  logoUrl: string | null;
  bannerUrl: string | null;
  guidelinesPdfUrl: string | null;
}) {
  const keyDates: KeyDates = event.keyDates;

  return (
    <Tabs defaultValue="basics" className="w-full">
      <TabsList className="mb-6 h-10 w-full justify-start sm:w-auto">
        <TabsTrigger value="basics">Basics</TabsTrigger>
        <TabsTrigger value="public">Public page</TabsTrigger>
        <TabsTrigger value="dates">Key dates</TabsTrigger>
      </TabsList>
      <TabsContent value="basics">
        <BasicsForm
          orgId={orgId}
          eventId={eventId}
          initialEvent={event}
          initialLogoUrl={logoUrl}
          initialBannerUrl={bannerUrl}
        />
      </TabsContent>
      <TabsContent value="public">
        <PublicPageForm
          orgId={orgId}
          eventId={eventId}
          orgSlug={orgSlug}
          eventSlug={eventSlug}
          initialEvent={event}
          guidelinesPdfUrl={guidelinesPdfUrl}
        />
      </TabsContent>
      <TabsContent value="dates">
        <KeyDatesForm
          orgId={orgId}
          eventId={eventId}
          initialKeyDates={keyDates}
        />
      </TabsContent>
    </Tabs>
  );
}
