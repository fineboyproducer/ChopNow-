/**
 * Typography scale. Font family is a system-first stack for performance
 * (no webfont download blocking first paint); apps may layer a display
 * font on top for marketing headings via Tailwind's `font-display`.
 */
export const fontFamily = {
  sans: [
    "Inter",
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
} as const;

export const fontSize = {
  xs: ["0.75rem", { lineHeight: "1rem" }],
  sm: ["0.8125rem", { lineHeight: "1.25rem" }],
  base: ["0.9375rem", { lineHeight: "1.5rem" }],
  lg: ["1.0625rem", { lineHeight: "1.625rem" }],
  xl: ["1.25rem", { lineHeight: "1.75rem" }],
  "2xl": ["1.5rem", { lineHeight: "2rem" }],
  "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
  "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
  "5xl": ["3rem", { lineHeight: "1.1" }],
  "6xl": ["3.75rem", { lineHeight: "1.05" }],
} as const;

export const fontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
  black: "900",
} as const;

export type FontSizeTokens = typeof fontSize;
