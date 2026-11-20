"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { ErrorState } from "@/components/shared/error-state";
import { FormField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { PageHeader } from "@/components/shared/page-header";
import { FormSkeleton } from "@/components/shared/skeletons";
import { toast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api/client";
import type { EligibilityDto } from "@/lib/types/api";

export function EligibilityPage({
  orgId,
  eventId,
}: {
  orgId: string;
  eventId: string;
}) {
  const base = `/api/v1/orgs/${orgId}/events/${eventId}/eligibility`;

  const [rule, setRule] = useState<EligibilityDto | null>(null);
  const [maxAbstracts, setMaxAbstracts] = useState("2");
  const [requireMemberAuthor, setRequireMemberAuthor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [maxError, setMaxError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await apiFetch<EligibilityDto>(base);
    if (!result.ok) {
      setLoadError(result.error.message || "The eligibility rules couldn't be loaded.");
      setLoading(false);
      return;
    }
    setLoadError(null);
    setRule(result.data);
    setMaxAbstracts(String(result.data.maxAbstractsPerAuthor));
    setRequireMemberAuthor(result.data.requireMemberAuthor);
    setLoading(false);
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    const max = Number.parseInt(maxAbstracts, 10);
    if (!Number.isFinite(max) || max < 1) {
      setMaxError("Enter a whole number of at least 1.");
      return;
    }
    setMaxError(null);

    setSaveLoading(true);
    try {
      const result = await apiFetch<EligibilityDto>(base, {
        method: "PUT",
        body: {
          maxAbstractsPerAuthor: max,
          requireMemberAuthor,
          presentingAuthorMustRegister:
            rule?.presentingAuthorMustRegister ?? true,
        },
      });
      if (!result.ok) {
        toast.error("Couldn't save the rules", { description: result.error.message });
        return;
      }
      setRule(result.data);
      toast.success("Eligibility rules saved");
    } finally {
      setSaveLoading(false);
    }
  }

  const dirty =
    !!rule &&
    (maxAbstracts !== String(rule.maxAbstractsPerAuthor) ||
      requireMemberAuthor !== rule.requireMemberAuthor);

  return (
    <div>
      <PageHeader
        title="Eligibility"
        description="Checked automatically when an author submits (EVT-07)."
      />

      {loading ? (
        <FormSkeleton fields={3} label="Loading eligibility rules…" />
      ) : loadError ? (
        <ErrorState
          title="Eligibility rules didn't load"
          description={loadError}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      ) : (
        <div className="max-w-3xl space-y-6">
          <FormSection title="Abstracts per author" description="Stops one person submitting more than this many abstracts to the event.">
            <FormField label="Maximum abstracts per author" required error={maxError} help="Most colleges allow 2.">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                className="max-w-32"
                value={maxAbstracts}
                onChange={(e) => setMaxAbstracts(e.target.value)}
              />
            </FormField>
          </FormSection>

          <FormSection title="Member authors" description="Uses the imported member list (Members).">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="require-member" className="text-base font-medium">
                  At least one author must be a member
                </Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  An author must match the member list by email or membership number.
                </p>
              </div>
              <Switch id="require-member" checked={requireMemberAuthor} onCheckedChange={setRequireMemberAuthor} />
            </div>
          </FormSection>

          <FormSection title="Presenting author registration">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-base font-medium">
                  <Lock className="size-4 text-muted-foreground" aria-hidden />
                  Presenting author must register
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Always on. An accepted abstract is confirmed in the programme only after its presenting author has
                  registered and paid.
                </p>
              </div>
              <Switch
                id="presenting-register"
                aria-label="Presenting author must register (always on)"
                checked={rule?.presentingAuthorMustRegister ?? true}
                disabled
              />
            </div>
          </FormSection>

          <div className="sticky bottom-0 z-10 -mx-gutter flex flex-col-reverse gap-2 border-t border-border bg-background/95 px-gutter py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-end md:mx-0 md:rounded-lg md:border md:px-4">
            <p className="text-sm text-muted-foreground sm:mr-auto" aria-live="polite">
              {dirty ? "You have unsaved changes." : "All changes saved."}
            </p>
            <Button type="button" disabled={saveLoading || !dirty} onClick={() => void save()}>
              {saveLoading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {saveLoading ? "Saving…" : "Save rules"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
