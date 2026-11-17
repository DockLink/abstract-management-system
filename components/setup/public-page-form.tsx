"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { GuidelinesEditor } from "@/components/setup/guidelines-editor";
import { PublicPagePreview } from "@/components/setup/public-page-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api/client";
import type { EventDto } from "@/lib/types/api";

export function PublicPageForm({
  orgId,
  eventId,
  orgSlug,
  eventSlug,
  initialEvent,
  guidelinesPdfUrl,
}: {
  orgId: string;
  eventId: string;
  orgSlug: string;
  eventSlug: string;
  initialEvent: EventDto;
  guidelinesPdfUrl: string | null;
}) {
  const publicPath = `/${orgSlug}/${eventSlug}`;

  const [richText, setRichText] = useState(
    initialEvent.guidelinesRichText ?? "",
  );
  const [pdfUrl, setPdfUrl] = useState(guidelinesPdfUrl);
  const [saving, setSaving] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${publicPath}`
        : publicPath;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Public URL copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy");
    }
  }

  async function saveGuidelines() {
    setSaving(true);
    try {
      const result = await apiFetch<EventDto>(
        `/api/v1/orgs/${orgId}/events/${eventId}`,
        {
          method: "PATCH",
          body: { guidelinesRichText: richText.trim() || null },
        },
      );
      if (!result.ok) {
        toast.error(result.error.message || "Could not save");
        return;
      }
      toast.success("Guidelines saved");
    } finally {
      setSaving(false);
    }
  }

  async function onPdfChange(file: File) {
    setUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.set("kind", "guidelines");
      formData.set("file", file);
      const result = await apiFetch<{ event: EventDto }>(
        `/api/v1/orgs/${orgId}/events/${eventId}/assets`,
        { method: "POST", formData },
      );
      if (!result.ok) {
        toast.error(result.error.message || "Upload failed");
        return;
      }
      toast.success("Guidelines PDF uploaded");
      setPdfUrl(URL.createObjectURL(file));
    } finally {
      setUploadingPdf(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <Label>Public URL</Label>
          <div className="flex gap-2">
            <Input readOnly value={publicPath} className="h-10 font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              className="h-10 shrink-0"
              onClick={() => void copyUrl()}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              <span className="sr-only">Copy</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Guidelines (rich text)</Label>
          <GuidelinesEditor value={richText} onChange={setRichText} />
          <Button
            type="button"
            className="h-10 w-fit"
            disabled={saving}
            onClick={() => void saveGuidelines()}
          >
            {saving ? "Saving…" : "Save guidelines"}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="guidelines-pdf">Guidelines PDF</Label>
          <Input
            id="guidelines-pdf"
            type="file"
            accept="application/pdf"
            className="h-10"
            disabled={uploadingPdf}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onPdfChange(file);
            }}
          />
          {pdfUrl ? (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary hover:underline"
            >
              View guidelines PDF
            </a>
          ) : null}
        </div>
      </div>

      <PublicPagePreview
        eventName={initialEvent.name}
        edition={initialEvent.edition}
        guidelinesHtml={richText}
      />
    </div>
  );
}
