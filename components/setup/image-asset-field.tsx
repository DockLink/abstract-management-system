"use client";

import { useId, useRef } from "react";
import Image from "next/image";
import { Loader2, Upload } from "lucide-react";
import { FileUpload } from "@/components/shared/file-upload";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Logo / banner upload. Empty: the shared FileUpload drop zone. Set: a
 * preview with a "Replace" button. Upload itself is the caller's (unchanged)
 * handler; this only presents it.
 */
export function ImageAssetField({
  label,
  help,
  url,
  uploading,
  aspect = "square",
  onSelect,
}: {
  label: string;
  help: string;
  url: string | null;
  uploading: boolean;
  aspect?: "square" | "wide";
  onSelect: (file: File) => void;
}) {
  const inputId = useId();
  const ref = useRef<HTMLInputElement>(null);

  if (!url) {
    return (
      <FileUpload
        label={label}
        accept="image/png,image/jpeg,image/webp"
        acceptLabel="PNG, JPEG or WebP"
        maxSizeMb={5}
        uploading={uploading}
        onSelect={onSelect}
      />
    );
  }

  return (
    <div className="grid gap-2">
      <p className="text-base font-medium">{label}</p>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center">
        <span
          className={cn(
            "relative block shrink-0 overflow-hidden rounded-md border border-border bg-white",
            aspect === "square" ? "size-20" : "aspect-[3/1] w-full sm:w-48",
          )}
        >
          <Image src={url} alt={`Current ${label.toLowerCase()}`} fill sizes="192px" className={aspect === "square" ? "object-contain p-1.5" : "object-cover"} unoptimized={url.startsWith("blob:")} />
        </span>
        <div className="min-w-0 flex-1 text-sm text-muted-foreground">{help}</div>
        <Button type="button" variant="outline" disabled={uploading} onClick={() => ref.current?.click()}>
          {uploading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Upload data-icon="inline-start" />}
          {uploading ? "Uploading…" : "Replace"}
        </Button>
        <input
          ref={ref}
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-label={`Replace ${label.toLowerCase()}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSelect(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
