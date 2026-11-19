"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Light is the default until every screen is on tokens: Module 2/3 screens
 * still carry raw palette classes that would break in dark mode. Flip
 * `defaultTheme` to "system" once docs/ui-audit.md step 6 is done.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
