import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background px-6 py-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary-tint text-primary">
        <Icon className="size-6" />
      </div>
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {actionLabel && onAction ? (
        <Button className="mt-5 h-10" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
