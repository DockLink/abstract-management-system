"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatEventDate,
  formatRelativeToNow,
} from "@/lib/dates";

export function EventDate({
  value,
  relative = false,
  includeTime = true,
}: {
  value: Date | string | null | undefined;
  relative?: boolean;
  includeTime?: boolean;
}) {
  const formatted = formatEventDate(value, { includeTime });
  if (!relative || !value) {
    return <span>{formatted}</span>;
  }

  const relativeLabel = formatRelativeToNow(value);
  return (
    <Tooltip>
      <TooltipTrigger className="cursor-default underline decoration-dotted underline-offset-2">
        {formatted}
      </TooltipTrigger>
      <TooltipContent>{relativeLabel}</TooltipContent>
    </Tooltip>
  );
}
