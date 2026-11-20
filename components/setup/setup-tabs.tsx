"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BasicsForm } from "@/components/setup/basics-form";
import { KeyDatesForm } from "@/components/setup/key-dates-form";
import { PublicPageForm } from "@/components/setup/public-page-form";
import type { EventDto, KeyDates } from "@/lib/types/api";

export type SetupTab = "basics" | "public" | "dates";

const LABELS: Record<SetupTab, string> = {
  basics: "Details and logo",
  public: "Guidelines",
  dates: "Key dates",
};

export function SetupTabs({
  initialTab,
  orgId,
  eventId,
  orgSlug,
  eventSlug,
  event,
  logoUrl,
  bannerUrl,
  guidelinesPdfUrl,
}: {
  initialTab: SetupTab;
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
  const [tab, setTab] = useState<SetupTab>(initialTab);
  // Follow checklist links (?tab=…) that change the prop without remounting.
  const [lastInitial, setLastInitial] = useState(initialTab);
  if (initialTab !== lastInitial) {
    setLastInitial(initialTab);
    setTab(initialTab);
  }

  const change = (value: string) => {
    const next = value as SetupTab;
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };

  return (
    <Tabs value={tab} onValueChange={change} className="w-full" id="setup-forms">
      <TabsList className="mb-2 h-auto w-full max-w-full justify-start overflow-x-auto sm:w-auto">
        {(Object.keys(LABELS) as SetupTab[]).map((t) => (
          <TabsTrigger key={t} value={t} className="min-h-control-sm px-4">
            {LABELS[t]}
          </TabsTrigger>
        ))}
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
        <KeyDatesForm orgId={orgId} eventId={eventId} initialKeyDates={keyDates} />
      </TabsContent>
    </Tabs>
  );
}
