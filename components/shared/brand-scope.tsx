import type { ComponentProps } from "react";
import { brandStyle } from "@/lib/theme/brand";
import { cn } from "@/lib/utils";

/**
 * Re-brands everything inside it with an event's primary colour (GEN-02).
 * Buttons, rings, links, tints and charts all follow `--brand`.
 *
 *   <BrandScope brand={event.primaryColor}>…public event page…</BrandScope>
 */
export function BrandScope({
  brand,
  className,
  style,
  ...props
}: Omit<ComponentProps<"div">, "color"> & { brand?: string | null }) {
  return (
    <div
      data-brand-scope=""
      className={cn("contents", className)}
      style={{ ...brandStyle(brand), ...style }}
      {...props}
    />
  );
}
