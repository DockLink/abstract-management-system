"use client";

import { useId, useRef, useState } from "react";
import { AlertCircle, FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type UploadedFile = { name: string; size: number; url?: string };

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Single-file upload (ERC certificate, logo, CSV, bank slip).
 *
 * Controlled: the parent owns `value`, `uploading`, `progress` and `error`;
 * this component validates type/size before calling `onSelect`. On phones the
 * whole drop area is a 44px+ button that opens the file picker / camera.
 */
export function FileUpload({
  label,
  accept,
  acceptLabel,
  maxSizeMb = 5,
  value,
  uploading = false,
  progress,
  error,
  disabled = false,
  onSelect,
  onRemove,
  className,
}: {
  label: string;
  /** e.g. ".pdf,image/*" */
  accept?: string;
  /** Human version of accept: "PDF, JPG or PNG". */
  acceptLabel?: string;
  maxSizeMb?: number;
  value?: UploadedFile | null;
  uploading?: boolean;
  /** 0–100 while uploading. */
  progress?: number;
  error?: string | null;
  disabled?: boolean;
  onSelect: (file: File) => void;
  onRemove?: () => void;
  className?: string;
}) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const shownError = error ?? localError;

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setLocalError(`${file.name} is ${formatSize(file.size)}. The limit is ${maxSizeMb} MB.`);
      return;
    }
    setLocalError(null);
    onSelect(file);
  };

  const hint = `${acceptLabel ?? "Any file"} · up to ${maxSizeMb} MB`;

  if (value && !uploading) {
    return (
      <div className={cn("grid gap-2", className)}>
        <p className="text-base font-medium">{label}</p>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-tint text-brand-ink">
            <FileText className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            {value.url ? (
              <a href={value.url} target="_blank" rel="noreferrer" className="block truncate font-medium text-brand-ink hover:underline">
                {value.name}
              </a>
            ) : (
              <p className="truncate font-medium">{value.name}</p>
            )}
            <p className="text-sm text-muted-foreground">{formatSize(value.size)}</p>
          </div>
          {onRemove && !disabled ? (
            <Button variant="ghost" size="icon" onClick={onRemove} aria-label={`Remove ${value.name}`}>
              <X />
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={inputId} className="text-base font-medium">
        {label}
      </label>
      <div
        className={cn(
          "relative flex min-h-32 flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
          dragging ? "border-primary bg-primary-tint" : "border-input bg-background",
          shownError && "border-danger/60",
          (disabled || uploading) && "opacity-70",
        )}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled && !uploading) pick(e.dataTransfer.files);
        }}
      >
        {uploading ? (
          <div className="w-full max-w-xs space-y-3" role="status" aria-live="polite">
            <p className="flex items-center justify-center gap-2 text-base">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Uploading…{progress !== undefined ? ` ${Math.round(progress)}%` : ""}
            </p>
            {progress !== undefined ? <Progress value={progress} aria-label="Upload progress" /> : null}
          </div>
        ) : (
          <>
            <Upload className="mb-2 size-7 text-brand-ink" aria-hidden />
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              aria-describedby={hintId}
            >
              Choose file
            </Button>
            <p className="mt-2 hidden text-sm text-muted-foreground md:block">or drag it here</p>
            <p id={hintId} className="mt-1 text-sm text-muted-foreground">
              {hint}
            </p>
          </>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          disabled={disabled || uploading}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {shownError ? (
        <p className="flex items-start gap-1.5 text-sm font-medium text-danger-foreground" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {shownError}
        </p>
      ) : null}
    </div>
  );
}
