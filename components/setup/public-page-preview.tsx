"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { sanitizeRichHtml } from "@/lib/html";

export function PublicPagePreview({
  eventName,
  edition,
  guidelinesHtml,
}: {
  eventName: string;
  edition: string | null;
  guidelinesHtml: string;
}) {
  const html = guidelinesHtml.trim()
    ? sanitizeRichHtml(guidelinesHtml)
  : "<p class=\"text-muted-foreground\">No guidelines yet.</p>";

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">Public page preview</CardTitle>
        <CardDescription>Read-only — submit is disabled here</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-lg font-semibold">{eventName || "Event"}</p>
          {edition ? (
            <p className="text-sm text-muted-foreground">{edition}</p>
          ) : null}
        </div>
        <div
          className="prose prose-sm max-w-none rounded-lg border border-border bg-surface p-4"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <Button type="button" className="h-10 w-full sm:w-auto" disabled>
          Submit abstract
        </Button>
      </CardContent>
    </Card>
  );
}
