"use client";

import { useCallback, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export function CsvImportDropzone({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      onFile(file);
    },
    [onFile],
  );

  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center transition-colors",
        dragging && "border-primary bg-primary-tint",
        disabled && "pointer-events-none opacity-50",
      )}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <Upload className="mb-3 size-8 text-primary" />
      <p className="text-sm font-medium text-foreground">
        Drop a CSV here, or click to browse
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Expected columns: name, membership number, SLMC number, email
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </label>
  );
}
