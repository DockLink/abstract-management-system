import { StatusBadge, type StatusKey } from "@/components/shared/status-badge";

export function DateDrivenStateChip({
  label,
  active,
  activeLabel,
  inactiveLabel,
}: {
  label: string;
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  const status: StatusKey = active ? "success" : "info";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <StatusBadge
        status={status}
        label={
          active
            ? (activeLabel ?? "will be OPEN")
            : (inactiveLabel ?? "will be CLOSED")
        }
      />
    </div>
  );
}
