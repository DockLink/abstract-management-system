"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/shared/toast";
import { FormField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { EventHeaderPreview } from "@/components/setup/event-header-preview";
import { ImageAssetField } from "@/components/setup/image-asset-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/dates";
import type { EventDto } from "@/lib/types/api";

const basicsSchema = z
  .object({
    name: z.string().min(1, "Enter the event name.").max(200),
    edition: z.string().max(200),
    venue: z.string().max(300),
    startsAt: z.string(),
    endsAt: z.string(),
    contactEmail: z
      .string()
      .max(200)
      .refine((v) => !v || z.string().email().safeParse(v).success, {
        message: "Enter a valid email address, like secretary@college.lk.",
      }),
    contactPhone: z.string().max(40),
  })
  .superRefine((data, ctx) => {
    const start = fromDatetimeLocalValue(data.startsAt);
    const end = fromDatetimeLocalValue(data.endsAt);
    if (start && end && end < start) {
      ctx.addIssue({
        code: "custom",
        message: "The event must end on or after the day it starts.",
        path: ["endsAt"],
      });
    }
  });

type BasicsFormValues = z.infer<typeof basicsSchema>;

function eventToDefaults(event: EventDto): BasicsFormValues {
  return {
    name: event.name,
    edition: event.edition ?? "",
    venue: event.venue ?? "",
    startsAt: toDatetimeLocalValue(event.startsAt),
    endsAt: toDatetimeLocalValue(event.endsAt),
    contactEmail: event.contactEmail ?? "",
    contactPhone: event.contactPhone ?? "",
  };
}

export function BasicsForm({
  orgId,
  eventId,
  initialEvent,
  initialLogoUrl,
  initialBannerUrl,
}: {
  orgId: string;
  eventId: string;
  initialEvent: EventDto;
  initialLogoUrl: string | null;
  initialBannerUrl: string | null;
}) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [bannerUrl, setBannerUrl] = useState(initialBannerUrl);
  const [uploading, setUploading] = useState<"logo" | "banner" | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const form = useForm<BasicsFormValues>({
    resolver: zodResolver(basicsSchema),
    defaultValues: eventToDefaults(initialEvent),
  });

  const watched = form.watch();

  async function uploadAsset(kind: "logo" | "banner", file: File) {
    setUploading(kind);
    try {
      const formData = new FormData();
      formData.set("kind", kind);
      formData.set("file", file);
      const result = await apiFetch<{ event: EventDto; path: string }>(
        `/api/v1/orgs/${orgId}/events/${eventId}/assets`,
        { method: "POST", formData },
      );
      if (!result.ok) {
        toast.error(`Couldn't upload the ${kind}`, { description: result.error.message });
        return;
      }
      toast.success(`${kind === "logo" ? "Logo" : "Banner"} uploaded`);
      router.refresh();
      if (kind === "logo" && logoUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(logoUrl);
      }
      if (kind === "banner" && bannerUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(bannerUrl);
      }
      const previewUrl = URL.createObjectURL(file);
      if (kind === "logo") setLogoUrl(previewUrl);
      else setBannerUrl(previewUrl);
    } finally {
      setUploading(null);
    }
  }

  async function onSubmit(values: BasicsFormValues) {
    setSaving(true);
    try {
      const body = {
        name: values.name,
        edition: values.edition.trim() || null,
        venue: values.venue.trim() || null,
        startsAt: fromDatetimeLocalValue(values.startsAt)?.toISOString() ?? null,
        endsAt: fromDatetimeLocalValue(values.endsAt)?.toISOString() ?? null,
        contactEmail: values.contactEmail.trim() || null,
        contactPhone: values.contactPhone.trim() || null,
      };
      const result = await apiFetch<EventDto>(
        `/api/v1/orgs/${orgId}/events/${eventId}`,
        { method: "PATCH", body },
      );
      if (!result.ok) {
        toast.error("Couldn't save event details", { description: result.error.message });
        return;
      }
      toast.success("Event details saved");
      form.reset(eventToDefaults(result.data));
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const previewStarts = fromDatetimeLocalValue(watched.startsAt)?.toISOString() ?? null;
  const previewEnds = fromDatetimeLocalValue(watched.endsAt)?.toISOString() ?? null;

  const errors = form.formState.errors;
  const dirty = form.formState.isDirty;

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <form className="min-w-0 space-y-6" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormSection title="Event details" description="Shown at the top of the public page and on emails.">
          <FormField label="Event name" required error={errors.name?.message}>
            <Input {...form.register("name")} />
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Edition" optional help='e.g. "54th Annual Academic Sessions"'>
              <Input {...form.register("edition")} />
            </FormField>
            <FormField label="Venue" optional help="e.g. BMICH, Colombo">
              <Input {...form.register("venue")} />
            </FormField>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Starts" optional help="Sri Lanka time">
              <Input type="datetime-local" {...form.register("startsAt")} />
            </FormField>
            <FormField label="Ends" optional error={errors.endsAt?.message} help="Sri Lanka time">
              <Input type="datetime-local" {...form.register("endsAt")} />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Contact" description="Where authors send questions. Shown on the public page.">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Email" optional error={errors.contactEmail?.message}>
              <Input type="email" inputMode="email" {...form.register("contactEmail")} />
            </FormField>
            <FormField label="Phone" optional>
              <Input type="tel" inputMode="tel" {...form.register("contactPhone")} />
            </FormField>
          </div>
        </FormSection>

        <FormSection
          title="Logo and banner"
          description="Uploads save straight away. Use a square logo and a wide banner (about 3:1)."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <ImageAssetField
              label="Logo"
              help="Square, at least 256 × 256 px. PNG with a transparent background works best."
              url={logoUrl}
              aspect="square"
              uploading={uploading === "logo"}
              onSelect={(file) => void uploadAsset("logo", file)}
            />
            <ImageAssetField
              label="Banner"
              help="About 1500 × 500 px. Avoid text near the edges — phones crop it."
              url={bannerUrl}
              aspect="wide"
              uploading={uploading === "banner"}
              onSelect={(file) => void uploadAsset("banner", file)}
            />
          </div>
        </FormSection>

        <div className="sticky bottom-0 z-10 -mx-gutter flex flex-col-reverse gap-2 border-t border-border bg-background/95 px-gutter py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-end md:mx-0 md:rounded-lg md:border md:px-4">
          <p className="text-sm text-muted-foreground sm:mr-auto" aria-live="polite">
            {dirty ? "You have unsaved changes." : "All changes saved."}
          </p>
          <Button type="button" variant="outline" disabled={!dirty || saving} onClick={() => form.reset()}>
            Discard
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            {saving ? "Saving…" : "Save details"}
          </Button>
        </div>
      </form>

      <aside className="hidden xl:block">
        <div className="sticky top-24">
          <p className="mb-2 text-sm font-medium text-muted-foreground">Preview</p>
          <EventHeaderPreview
            name={watched.name}
            edition={watched.edition.trim() || null}
            venue={watched.venue.trim() || null}
            startsAt={previewStarts}
            endsAt={previewEnds}
            logoUrl={logoUrl}
            bannerUrl={bannerUrl}
          />
        </div>
      </aside>
    </div>
  );
}
