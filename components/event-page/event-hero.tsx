import type { ReactNode } from "react";
import Image from "next/image";
import { CalendarDays, MapPin } from "lucide-react";
import { BrandGrid } from "@/components/shared/brand-grid";
import { cn } from "@/lib/utils";

/**
 * Event hero. With a banner: the image sits above the title (text is never
 * laid over a photo, so any banner stays legible). Without one: a band in
 * the event's brand colour with a fine ECG-paper grid — recognisably
 * clinical, and it looks intentional rather than missing.
 * Long names wrap and hyphenate; the title never truncates.
 */
export function EventHero({
  orgName,
  name,
  edition,
  venue,
  dateRange,
  bannerUrl,
  logoUrl,
  status,
  actions,
  footnote,
}: {
  orgName: string;
  name: string;
  edition: string | null;
  venue: string | null;
  dateRange: string | null;
  bannerUrl: string | null;
  logoUrl: string | null;
  status?: ReactNode;
  actions: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <header className="bg-background">
      {bannerUrl ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted sm:aspect-[3/1] lg:aspect-[4/1]">
          <Image src={bannerUrl} alt="" fill priority sizes="100vw" className="object-cover" unoptimized />
        </div>
      ) : (
        <BrandGrid aria-hidden className="h-28 w-full sm:h-36 lg:h-44" />
      )}

      <div className="mx-auto max-w-6xl px-gutter pb-8 md:px-8 md:pb-10">
        <div className={cn("flex flex-col gap-5", logoUrl ? "-mt-10 sm:-mt-12" : "pt-6 md:pt-8")}>
          {logoUrl ? (
            <span className="relative block size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-white shadow-overlay sm:size-24">
              <Image src={logoUrl} alt={`${name} logo`} fill sizes="96px" className="object-contain p-2" unoptimized />
            </span>
          ) : null}

          <div className="min-w-0">
            <p className="text-base text-muted-foreground">{orgName}</p>
            <h1 className="mt-1 max-w-[22ch] font-heading text-3xl leading-[1.1] font-semibold tracking-[-0.015em] [overflow-wrap:anywhere] hyphens-auto sm:text-4xl lg:text-5xl">
              {name}
            </h1>
            {edition ? <p className="mt-2 text-lg text-muted-foreground md:text-xl">{edition}</p> : null}

            <dl className="mt-4 flex flex-col gap-2 text-base sm:flex-row sm:flex-wrap sm:gap-x-6">
              {dateRange ? (
                <div className="flex items-center gap-2">
                  <dt className="sr-only">Dates</dt>
                  <CalendarDays className="size-5 shrink-0 text-brand-ink" aria-hidden />
                  <dd>{dateRange}</dd>
                </div>
              ) : null}
              {venue ? (
                <div className="flex items-start gap-2">
                  <dt className="sr-only">Venue</dt>
                  <MapPin className="mt-0.5 size-5 shrink-0 text-brand-ink" aria-hidden />
                  <dd>{venue}</dd>
                </div>
              ) : null}
            </dl>
            {status ? <div className="mt-4">{status}</div> : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">{actions}</div>
          {footnote}
        </div>
      </div>
    </header>
  );
}
