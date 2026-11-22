"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { KeyDates as KeyDatesTimeline } from "@/components/event-page/key-dates";
import { FormField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { StatusBadge } from "@/components/shared/status-badge";
import { toast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNow } from "@/lib/hooks/use-now";
import { apiFetch } from "@/lib/api/client";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/dates";
import { derivePortalState } from "@/lib/services/events/portal-state";
import type { KeyDates } from "@/lib/types/api";

const FIELDS: Array<{ key: keyof KeyDates; label: string; help: string }> = [
  { key: "submissionOpenAt", label: "Submissions open", help: "Authors can start submitting from this moment." },
  { key: "submissionCloseAt", label: "Submission deadline", help: "The Submit button closes. Drafts stay saved." },
  { key: "reviewDeadlineAt", label: "Reviews due", help: "Reviewers should finish scoring by now." },
  { key: "notificationAt", label: "Decisions announced", help: "Authors hear whether they're accepted." },
  { key: "earlyBirdEndAt", label: "Early-bird registration ends", help: "Early-bird ticket prices stop." },
  { key: "registrationCloseAt", label: "Registration closes", help: "No more registrations after this." },
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
        message: "The deadline must be on or after the day submissions open.",
        path: ["submissionCloseAt"],
      });
    }
    const review = fromDatetimeLocalValue(data.reviewDeadlineAt);
    if (close && review && review < close) {
      ctx.addIssue({
        code: "custom",
        message: "Reviews are due after the submission deadline.",
        path: ["reviewDeadlineAt"],
      });
    }
    const notify = fromDatetimeLocalValue(data.notificationAt);
    if (review && notify && notify < review) {
      ctx.addIssue({
        code: "custom",
        message: "Decisions go out on or after the review deadline.",
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
  const router = useRouter();
  const now = useNow();
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
        toast.error("Couldn't save the key dates", { description: result.error.message });
        return;
      }
      toast.success("Key dates saved");
      form.reset(keyDatesToForm(result.data));
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const errors = form.formState.errors;
  const dirty = form.formState.isDirty;
  const preview = formToKeyDatesBody(watched);

  const states: Array<{ label: string; on: boolean; onLabel: string; offLabel: string }> = [
    { label: "Submissions", on: portalState.submissionOpen, onLabel: "Submissions open", offLabel: "Submissions closed" },
    { label: "Reviews", on: portalState.reviewOpen, onLabel: "Reviewing open", offLabel: "Reviewing closed" },
    { label: "Early-bird", on: portalState.earlyBirdActive, onLabel: "Early-bird on", offLabel: "Early-bird over" },
    { label: "Registration", on: portalState.registrationOpen, onLabel: "Registration open", offLabel: "Registration closed" },
  ];

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <form className="min-w-0 space-y-6" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormSection
          title="Key dates"
          description="Each date switches the portal automatically. All times are Sri Lanka time (Asia/Colombo)."
          aside={
            <div className="flex flex-wrap gap-1.5" aria-label="Portal right now, with these dates">
              {states.map((st) => (
                <StatusBadge key={st.label} status={st.on ? "open" : "closed"} label={st.on ? st.onLabel : st.offLabel} size="sm" />
              ))}
            </div>
          }
        >
          <ol className="grid gap-6">
            {FIELDS.map((field, i) => (
              <li key={field.key} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                <span
                  aria-hidden
                  className="mt-1 flex size-8 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold tabular-nums text-muted-foreground"
                >
                  {i + 1}
                </span>
                <FormField label={field.label} help={field.help} error={errors[field.key]?.message}>
                  <Input type="datetime-local" className="sm:max-w-xs" {...form.register(field.key)} />
                </FormField>
              </li>
            ))}
          </ol>
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
            {saving ? "Saving…" : "Save key dates"}
          </Button>
        </div>
      </form>

      <aside className="min-w-0">
        <div className="rounded-lg border border-border bg-card p-4 md:p-5 xl:sticky xl:top-24">
          <h3 className="mb-4 text-lg font-semibold">How authors will see it</h3>
          {now ? <KeyDatesTimeline keyDates={preview} now={now.toISOString()} /> : null}
        </div>
      </aside>
    </div>
  );
}
