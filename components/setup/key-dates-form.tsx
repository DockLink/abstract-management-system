"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { DateDrivenStateChip } from "@/components/shared/date-driven-state-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api/client";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/dates";
import { derivePortalState } from "@/lib/services/events/portal-state";
import type { KeyDates } from "@/lib/types/api";

const FIELDS: Array<{ key: keyof KeyDates; label: string }> = [
  { key: "submissionOpenAt", label: "Submission open" },
  { key: "submissionCloseAt", label: "Submission close" },
  { key: "reviewDeadlineAt", label: "Review deadline" },
  { key: "notificationAt", label: "Author notification" },
  { key: "earlyBirdEndAt", label: "Early-bird end" },
  { key: "registrationCloseAt", label: "Registration close" },
];

const keyDatesFormSchema = z
  .object({
    submissionOpenAt: z.string(),
    submissionCloseAt: z.string(),
    reviewDeadlineAt: z.string(),
    notificationAt: z.string(),
    earlyBirdEndAt: z.string(),
    registrationCloseAt: z.string(),
  })
  .superRefine((data, ctx) => {
    const open = fromDatetimeLocalValue(data.submissionOpenAt);
    const close = fromDatetimeLocalValue(data.submissionCloseAt);
    if (open && close && close < open) {
      ctx.addIssue({
        code: "custom",
        message: "Close must be on or after open",
        path: ["submissionCloseAt"],
      });
    }
    const review = fromDatetimeLocalValue(data.reviewDeadlineAt);
    if (close && review && review < close) {
      ctx.addIssue({
        code: "custom",
        message: "Review deadline should be after submission close",
        path: ["reviewDeadlineAt"],
      });
    }
    const notify = fromDatetimeLocalValue(data.notificationAt);
    if (review && notify && notify < review) {
      ctx.addIssue({
        code: "custom",
        message: "Notification should be on or after review deadline",
        path: ["notificationAt"],
      });
    }
  });

type FormValues = z.infer<typeof keyDatesFormSchema>;

function keyDatesToForm(keyDates: KeyDates): FormValues {
  return {
    submissionOpenAt: toDatetimeLocalValue(keyDates.submissionOpenAt),
    submissionCloseAt: toDatetimeLocalValue(keyDates.submissionCloseAt),
    reviewDeadlineAt: toDatetimeLocalValue(keyDates.reviewDeadlineAt),
    notificationAt: toDatetimeLocalValue(keyDates.notificationAt),
    earlyBirdEndAt: toDatetimeLocalValue(keyDates.earlyBirdEndAt),
    registrationCloseAt: toDatetimeLocalValue(keyDates.registrationCloseAt),
  };
}

function formToKeyDatesBody(values: FormValues): KeyDates {
  const toIso = (s: string) =>
    s ? fromDatetimeLocalValue(s)?.toISOString() ?? null : null;
  return {
    submissionOpenAt: toIso(values.submissionOpenAt),
    submissionCloseAt: toIso(values.submissionCloseAt),
    reviewDeadlineAt: toIso(values.reviewDeadlineAt),
    notificationAt: toIso(values.notificationAt),
    earlyBirdEndAt: toIso(values.earlyBirdEndAt),
    registrationCloseAt: toIso(values.registrationCloseAt),
  };
}

function formValuesToPortalInput(values: FormValues) {
  const kd = formToKeyDatesBody(values);
  return {
    submissionOpenAt: kd.submissionOpenAt
      ? new Date(kd.submissionOpenAt)
      : null,
    submissionCloseAt: kd.submissionCloseAt
      ? new Date(kd.submissionCloseAt)
      : null,
    reviewDeadlineAt: kd.reviewDeadlineAt
      ? new Date(kd.reviewDeadlineAt)
      : null,
    earlyBirdEndAt: kd.earlyBirdEndAt ? new Date(kd.earlyBirdEndAt) : null,
    registrationCloseAt: kd.registrationCloseAt
      ? new Date(kd.registrationCloseAt)
      : null,
  };
}

export function KeyDatesForm({
  orgId,
  eventId,
  initialKeyDates,
}: {
  orgId: string;
  eventId: string;
  initialKeyDates: KeyDates;
}) {
  const [saving, setSaving] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(keyDatesFormSchema),
    defaultValues: keyDatesToForm(initialKeyDates),
  });

  const watched = form.watch();
  const portalState = useMemo(
    () => derivePortalState(formValuesToPortalInput(watched)),
    [watched],
  );

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      const body = formToKeyDatesBody(values);
      const result = await apiFetch<KeyDates>(
        `/api/v1/orgs/${orgId}/events/${eventId}/key-dates`,
        { method: "PUT", body },
      );
      if (!result.ok) {
        toast.error(result.error.message || "Could not save");
        return;
      }
      toast.success("Key dates saved");
      form.reset(keyDatesToForm(result.data));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="max-w-xl space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-surface p-4">
        <DateDrivenStateChip
          label="Submissions"
          active={portalState.submissionOpen}
          activeLabel="OPEN"
          inactiveLabel="CLOSED"
        />
        <DateDrivenStateChip
          label="Reviews"
          active={portalState.reviewOpen}
          activeLabel="OPEN"
          inactiveLabel="CLOSED"
        />
        <DateDrivenStateChip
          label="Early-bird"
          active={portalState.earlyBirdActive}
          activeLabel="ACTIVE"
          inactiveLabel="ENDED"
        />
        <DateDrivenStateChip
          label="Registration"
          active={portalState.registrationOpen}
          activeLabel="OPEN"
          inactiveLabel="CLOSED"
        />
      </div>

      <div className="grid gap-4">
        {FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col gap-2">
            <Label htmlFor={field.key}>{field.label}</Label>
            <Input
              id={field.key}
              type="datetime-local"
              className="h-10"
              {...form.register(field.key)}
            />
            {form.formState.errors[field.key] ? (
              <p className="text-xs text-destructive">
                {form.formState.errors[field.key]?.message}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <Button type="submit" className="h-10" disabled={saving}>
        {saving ? "Saving…" : "Save key dates"}
      </Button>
    </form>
  );
}
