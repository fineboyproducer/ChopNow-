/**
 * ChopNow color tokens — single source of truth, consumed by
 * tailwind.config.ts in every app so brand colors can never drift
 * between apps. Matches the brand sheet: primary orange, charcoal,
 * success green, white/near-white surfaces.
 *
 * Values are plain hex so they can be referenced both from Tailwind
 * config (build-time) and directly from TS/JS at runtime (e.g. for
 * canvas/SVG drawing, chart colors) without re-parsing CSS variables.
 */
export const colors = {
  brand: {
    orange: "#FF6B00",
    orangeDark: "#E85F00",
    orangeSoft: "#FFF1E6",
  },
  charcoal: {
    DEFAULT: "#1F2937",
    soft: "#6B7280",
  },
  success: {
    DEFAULT: "#22C55E",
    soft: "#E9F9EE",
  },
  warning: {
    DEFAULT: "#F5A623",
    soft: "#FEF3E2",
  },
  danger: {
    DEFAULT: "#EF4444",
    soft: "#FEECEC",
  },
  info: {
    DEFAULT: "#4C9EFF",
    soft: "#EAF3FF",
  },
  surface: {
    DEFAULT: "#FFFFFF",
    accent: "#F8F8F8",
    border: "#EEEEEC",
    borderStrong: "#D5D8DE",
  },
  // Dark-mode surface set — used by apps that support dark mode (all three
  // apps do; the ops-center-style dense dashboards lean on this palette
  // most heavily, per the earlier Ops Center design work).
  surfaceDark: {
    bg: "#0B0F14",
    DEFAULT: "#12161C",
    accent: "#181D25",
    border: "#232A34",
    borderStrong: "#2C3440",
  },
  text: {
    DEFAULT: "#1F2937",
    muted: "#6B7280",
    faint: "#9CA3AF",
    inverse: "#FFFFFF",
  },
  textDark: {
    DEFAULT: "#E8EAED",
    muted: "#8B95A3",
    faint: "#5B6472",
  },
} as const;

export type ColorTokens = typeof colors;
