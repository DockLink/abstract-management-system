"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

  const load = useCallback(async () => {
    const result = await apiFetch<EligibilityDto>(base);
    if (!result.ok) {
      toast.error(result.error.message || "Could not load eligibility");
      setLoading(false);
      return;
    }
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
      toast.error("Max abstracts must be at least 1");
      return;
    }

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
        toast.error(result.error.message || "Could not save eligibility");
        return;
      }
      setRule(result.data);
      toast.success("Eligibility saved");
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Eligibility"
        description="Rules applied when authors submit abstracts."
        actions={
          <Button
            type="button"
            className="h-10"
            disabled={loading || saveLoading}
            onClick={() => void save()}
          >
            {saveLoading ? "Saving…" : "Save changes"}
          </Button>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border border-border bg-white">
            <CardHeader>
              <CardTitle className="text-base">Submission limit</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Label htmlFor="max-abstracts">Max abstracts per author</Label>
              <Input
                id="max-abstracts"
                className="h-10"
                type="number"
                min={1}
                max={50}
                value={maxAbstracts}
                onChange={(e) => setMaxAbstracts(e.target.value)}
              />
            </CardContent>
          </Card>

          <Card className="border border-border bg-white">
            <CardHeader>
              <CardTitle className="text-base">Member author</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="require-member">Require member author</Label>
                <p className="text-xs text-muted-foreground">
                  At least one author must match the member list.
                </p>
              </div>
              <Switch
                id="require-member"
                checked={requireMemberAuthor}
                onCheckedChange={setRequireMemberAuthor}
              />
            </CardContent>
          </Card>

          <Card className="border border-border bg-white">
            <CardHeader>
              <CardTitle className="text-base">Registration</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="presenting-register">
                  Presenting author must register
                </Label>
                <p className="text-xs text-muted-foreground">
                  Tied to registration and confirmation (DEC-09).
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Switch
                      id="presenting-register"
                      checked={rule?.presentingAuthorMustRegister ?? true}
                      disabled
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Controlled automatically when registration is linked (DEC-09).
                  Presenting authors are confirmed after paid registration.
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
