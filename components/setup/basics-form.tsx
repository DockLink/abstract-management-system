"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { EventHeaderPreview } from "@/components/setup/event-header-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api/client";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/dates";
import type { EventDto } from "@/lib/types/api";

const basicsSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(200),
    edition: z.string().max(200),
    venue: z.string().max(300),
    startsAt: z.string(),
    endsAt: z.string(),
    contactEmail: z
      .string()
      .max(200)
      .refine((v) => !v || z.string().email().safeParse(v).success, {
        message: "Invalid email",
      }),
    contactPhone: z.string().max(40),
  })
  .superRefine((data, ctx) => {
    const start = fromDatetimeLocalValue(data.startsAt);
    const end = fromDatetimeLocalValue(data.endsAt);
    if (start && end && end < start) {
      ctx.addIssue({
        code: "custom",
        message: "End must be on or after start",
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
        toast.error(result.error.message || "Upload failed");
        return;
      }
      toast.success(`${kind === "logo" ? "Logo" : "Banner"} uploaded`);
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
        toast.error(result.error.message || "Could not save");
        return;
      }
      toast.success("Event basics saved");
      form.reset(eventToDefaults(result.data));
    } finally {
      setSaving(false);
    }
  }

  const previewStarts = fromDatetimeLocalValue(watched.startsAt)?.toISOString() ?? null;
  const previewEnds = fromDatetimeLocalValue(watched.endsAt)?.toISOString() ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="name">Event name</Label>
            <Input id="name" className="h-10" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edition">Edition</Label>
            <Input id="edition" className="h-10" {...form.register("edition")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="venue">Venue</Label>
            <Input id="venue" className="h-10" {...form.register("venue")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="startsAt">Starts</Label>
            <Input
              id="startsAt"
              type="datetime-local"
              className="h-10"
              {...form.register("startsAt")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="endsAt">Ends</Label>
            <Input
              id="endsAt"
              type="datetime-local"
              className="h-10"
              {...form.register("endsAt")}
            />
            {form.formState.errors.endsAt ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.endsAt.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input
              id="contactEmail"
              type="email"
              className="h-10"
              {...form.register("contactEmail")}
            />
            {form.formState.errors.contactEmail ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.contactEmail.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="contactPhone">Contact phone</Label>
            <Input
              id="contactPhone"
              className="h-10"
              {...form.register("contactPhone")}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="logo">Logo</Label>
            <Input
              id="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="h-10"
              disabled={uploading === "logo"}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadAsset("logo", file);
              }}
            />
            <p className="text-xs text-muted-foreground">PNG, JPEG, or WebP — max 5 MB</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="banner">Banner</Label>
            <Input
              id="banner"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="h-10"
              disabled={uploading === "banner"}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadAsset("banner", file);
              }}
            />
            <p className="text-xs text-muted-foreground">PNG, JPEG, or WebP — max 5 MB</p>
          </div>
        </div>

        <Button type="submit" className="h-10" disabled={saving}>
          {saving ? "Saving…" : "Save basics"}
        </Button>
      </form>

      <div className="hidden lg:block">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Live preview
        </p>
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
    </div>
  );
}
