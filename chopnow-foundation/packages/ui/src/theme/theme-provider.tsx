"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes/dist/types";

/**
 * Thin wrapper around next-themes so every app configures dark/light
 * mode identically. Wrap the root layout's <body> children with this;
 * it handles persisting the user's choice (localStorage) and respecting
 * `prefers-color-scheme` for first-time visitors.
 *
 * Usage in an app's app/layout.tsx:
 *   <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
 *     {children}
 *   </ThemeProvider>
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
