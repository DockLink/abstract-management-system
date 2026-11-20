import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Brand-coloured surface with a fine ECG-paper grid (5 small squares per
 * large one). Used where an event has no banner image, and on sign-in.
 * Decorative: text placed on it uses --brand-foreground.
 */
export function BrandGrid({ className, style, ...props }: ComponentProps<"div">) {
  const line = (pct: number) => `color-mix(in oklch, var(--brand-foreground) ${pct}%, transparent)`;
  return (
    <div
      className={cn("bg-primary text-primary-foreground", className)}
      style={{
        backgroundImage: [
          `linear-gradient(${line(9)} 1px, transparent 1px)`,
          `linear-gradient(90deg, ${line(9)} 1px, transparent 1px)`,
          `linear-gradient(${line(4)} 1px, transparent 1px)`,
          `linear-gradient(90deg, ${line(4)} 1px, transparent 1px)`,
        ].join(","),
        backgroundSize: "40px 40px, 40px 40px, 8px 8px, 8px 8px",
        ...style,
      }}
      {...props}
    />
  );
}
