"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import { Award, Printer, Download, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Props {
  orgId: string;
  eventId: string;
  reviewerId: string | null;
  reviewerName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CertificateData {
  certificateId: string;
  reviewer: {
    id: string;
    fullName: string;
    email: string;
    institution: string | null;
  };
  event: {
    id: string;
    name: string;
    edition: string | null;
  };
  organisation: {
    name: string;
  };
  stats: {
    completedReviewsCount: number;
    issueDate: string;
  };
  html: string;
}

export function ReviewerCertificateModal({
  orgId,
  eventId,
  reviewerId,
  reviewerName,
  open,
  onOpenChange,
}: Props) {
  const [data, setData] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !reviewerId) return;

    let isMounted = true;
    setLoading(true);

    apiFetch<CertificateData>(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviews/certificate/${reviewerId}`,
    )
      .then((res) => {
        if (!isMounted) return;
        if (res.ok) {
          setData(res.data);
        } else {
          toast.error(res.error.message || "Failed to load certificate");
          onOpenChange(false);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error("Error generating certificate");
        console.error(err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, orgId, eventId, reviewerId, onOpenChange]);

  const handlePrint = () => {
    if (!data) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to print certificate");
      return;
    }
    printWindow.document.write(data.html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleOpenRaw = () => {
    if (!reviewerId) return;
    window.open(
      `/api/v1/orgs/${orgId}/events/${eventId}/reviews/certificate/${reviewerId}?format=html`,
      "_blank",
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Award className="h-6 w-6 text-warning-foreground" />
            Certificate of Appreciation
          </DialogTitle>
          <DialogDescription>
            Official reviewer certificate recognizing peer review contribution for{" "}
            {reviewerName || "Reviewer"}.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Generating certificate...</p>
          </div>
        ) : data ? (
          <div className="flex-1 overflow-auto border rounded-xl bg-muted  p-4 my-2">
            <div
              data-paper
              className="mx-auto max-w-2xl rounded-lg border-4 border-double border-foreground/70 bg-card p-8 text-center font-heading text-foreground shadow-sm"
            >
              <div className="text-xs tracking-widest text-muted-foreground uppercase font-sans font-semibold mb-2">
                {data.organisation.name}
              </div>
              <h2 className="mb-3 text-2xl font-semibold tracking-wide uppercase">
                Certificate of Appreciation
              </h2>
              <p className="text-sm italic text-muted-foreground mb-4">
                This certificate is proudly presented to
              </p>
              <div className="text-2xl font-bold text-foreground border-b pb-2 mb-4 inline-block px-8">
                {data.reviewer.fullName}
              </div>
              <p className="text-sm leading-relaxed text-foreground max-w-xl mx-auto mb-6">
                In sincere appreciation for your valuable contribution, dedication, and expert service
                as a peer reviewer for <strong>{data.event.name}</strong>. Your rigorous evaluation of{" "}
                <strong>{data.stats.completedReviewsCount} abstract(s)</strong> has helped uphold the
                highest academic standards of the conference.
              </p>
              <div className="flex justify-between items-center text-xs text-muted-foreground border-t pt-4 mt-6">
                <div>
                  <div className="mx-auto mb-1 w-24 border-b border-muted-foreground" />
                  Academic Chair
                </div>
                <div>Issued: {data.stats.issueDate}</div>
                <div>
                  <div className="mx-auto mb-1 w-24 border-b border-muted-foreground" />
                  Organising Committee
                </div>
              </div>
              <div className="text-xs font-mono text-muted-foreground text-right mt-4">
                ID: {data.certificateId}
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button variant="outline" onClick={handleOpenRaw} disabled={!data}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in New Window
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={handlePrint} disabled={!data} className="bg-primary text-primary-foreground">
              <Printer className="h-4 w-4 mr-2" />
              Print Certificate
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

