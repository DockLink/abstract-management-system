"use client";

import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Slide-over for multi-field tasks (create event, edit a category, add a
 * deadline extension, form builder). Full width on phones, a wide right
 * panel from sm. Header and footer stay put; only the body scrolls, so the
 * primary action is never pushed off-screen.
 */
export function SidePanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Actions. Primary last: it sits right on desktop, bottom on phones. */
  footer?: ReactNode;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex w-full flex-col gap-0 p-0 data-[side=right]:w-full",
          size === "md" ? "data-[side=right]:sm:max-w-lg" : "data-[side=right]:sm:max-w-2xl",
          className,
        )}
      >
        <SheetHeader className="border-b border-border px-gutter py-4 pr-14 sm:px-6">
          <SheetTitle className="font-heading text-2xl font-semibold">{title}</SheetTitle>
          {description ? (
            <SheetDescription className="text-base text-muted-foreground">{description}</SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-gutter py-5 sm:px-6">{children}</div>
        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t border-border bg-surface/60 px-gutter py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6 [&>*]:w-full sm:[&>*]:w-auto">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
