"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { FileUpload } from "@/components/shared/file-upload";
import { FormSection } from "@/components/shared/form-section";
import { toast } from "@/components/shared/toast";
import { GuidelinesEditor } from "@/components/setup/guidelines-editor";
import { Button } from "@/components/ui/button";
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
  const [savedHtml, setSavedHtml] = useState(initialEvent.guidelinesRichText ?? "");
  const router = useRouter();

  async function copyUrl() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${publicPath}`
        : publicPath;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link", { description: "Select the address and copy it instead." });
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
        toast.error("Couldn't save the guidelines", { description: result.error.message });
        return;
      }
      toast.success("Guidelines published");
      setSavedHtml(richText);
      router.refresh();
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
        toast.error("Couldn't upload the PDF", { description: result.error.message });
        return;
      }
      toast.success("Guidelines PDF uploaded");
      router.refresh();
      setPdfUrl(URL.createObjectURL(file));
    } finally {
      setUploadingPdf(false);
    }
  }

  const dirty = richText !== savedHtml;

  return (
    <div className="space-y-6">
      <FormSection title="Public page" description="Share this link in your call for abstracts.">
        <div className="flex flex-col gap-2 sm:flex-row">
          <code className="flex min-h-control min-w-0 flex-1 items-center overflow-x-auto rounded-md border border-border bg-muted px-3 font-mono text-sm whitespace-nowrap">
            {publicPath}
          </code>
          <Button type="button" variant="outline" onClick={() => void copyUrl()}>
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button variant="outline" asChild>
            <Link href={publicPath} target="_blank">
              <ExternalLink data-icon="inline-start" />
              Open
            </Link>
          </Button>
        </div>
      </FormSection>

      <FormSection
        title="Author guidelines"
        description="Formatting rules, word limits and what to include. Shown under “Call for abstracts” on the public page."
        footer={
          <>
            <Button type="button" variant="outline" disabled={!dirty || saving} onClick={() => setRichText(savedHtml)}>
              Discard
            </Button>
            <Button type="button" disabled={saving || !dirty} onClick={() => void saveGuidelines()}>
              {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {saving ? "Publishing…" : "Publish guidelines"}
            </Button>
          </>
        }
      >
        <GuidelinesEditor value={richText} onChange={setRichText} />
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {dirty ? "You have unpublished changes." : "The public page shows this version."}
        </p>
      </FormSection>

      <FormSection title="Guidelines PDF" description="Optional. Authors can download it from the public page.">
        <FileUpload
          label="Guidelines PDF"
          accept="application/pdf"
          acceptLabel="PDF"
          maxSizeMb={5}
          uploading={uploadingPdf}
          value={pdfUrl ? { name: "Author guidelines.pdf", size: 0, url: pdfUrl } : null}
          onSelect={(file) => void onPdfChange(file)}
        />
        {pdfUrl ? (
          <label className="inline-flex min-h-control w-fit cursor-pointer items-center rounded-md border border-border px-4 text-base font-medium hover:bg-muted">
            Replace PDF
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              disabled={uploadingPdf}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onPdfChange(file);
                e.target.value = "";
              }}
            />
          </label>
        ) : null}
      </FormSection>
    </div>
  );
}
