import type { CSSProperties } from "react";

/** Default brand when an event has no primaryColor (GEN-02). */
export const DEFAULT_BRAND = "#0f6e6a";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isValidBrandColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value.trim());
}

function toRgb(hex: string): [number, number, number] {
  let h = hex.trim().slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = Number.parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Pick white or ink text for a brand fill, whichever has more contrast. */
export function brandForeground(brand: string): string {
  const white = "#ffffff";
  const ink = "#121a20";
  return contrastRatio(brand, white) >= contrastRatio(brand, ink) ? white : ink;
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  const c = (x: number, y: number) =>
    Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`;
}

/**
 * Brand-coloured text for light surfaces. Dark brands are used as-is (CSS
 * mixes in a little ink); light brands (saffron, sky) are darkened toward ink
 * until they reach 4.5:1 on the page colour, so links stay readable.
 */
export function brandInkOnLight(brand: string): string | null {
  const paper = "#f7f8f6";
  const ink = "#121a20";
  if (contrastRatio(brand, paper) >= 4.6) return null;
  for (let t = 0.05; t <= 1; t += 0.05) {
    const candidate = mix(brand, ink, t);
    if (contrastRatio(candidate, paper) >= 4.6) return candidate;
  }
  return ink;
}

/**
 * Inline style that re-brands a subtree. Pair with the `data-brand-scope`
 * attribute (see <BrandScope>) so derived tokens recompute.
 * Invalid or empty colours fall back to the default brand.
 */
export function brandStyle(color?: string | null): CSSProperties {
  const brand = isValidBrandColor(color) ? color.trim() : DEFAULT_BRAND;
  const inkLight = brandInkOnLight(brand);
  return {
    "--brand": brand,
    "--brand-foreground": brandForeground(brand),
    ...(inkLight ? { "--brand-ink-light": inkLight } : {}),
  } as CSSProperties;
}
